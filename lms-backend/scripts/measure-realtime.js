#!/usr/bin/env node
/**
 * REAL-TIME MEASUREMENT SCRIPT
 * Đo thực tế từ backend đang chạy
 * 
 * Usage: node measure-realtime.js [--endpoint=/api/health] [--requests=30] [--concurrent=5]
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'papertest', 'paper2');

class RealtimeMetrics {
  constructor() {
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  async measureEndpoint(endpoint, method = 'GET', payload = null, count = 30) {
    console.log(`\n📊 Measuring ${endpoint} (${count} requests)...`);
    
    const times = [];
    const errors = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const start = Date.now();
        
        const config = {
          method,
          url: `${BASE_URL}${endpoint}`,
          timeout: 30000,
          validateStatus: () => true // Accept any status
        };
        
        if (payload && method !== 'GET') {
          config.data = payload;
        }
        
        const response = await axios(config);
        const elapsed = Date.now() - start;
        
        times.push({
          requestNum: i + 1,
          elapsedMs: elapsed,
          status: response.status,
          timestamp: new Date().toISOString()
        });
        
        process.stdout.write('.');
        if ((i + 1) % 10 === 0) process.stdout.write(` ${i + 1}/${count}\n`);
        
        // Small delay between requests
        await new Promise(r => setTimeout(r, 50));
        
      } catch (error) {
        errors.push({
          requestNum: i + 1,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        process.stdout.write('X');
      }
    }
    
    console.log('\n✅ Measurement complete');
    
    return this.calculateStats(times, errors, endpoint, method);
  }

  calculateStats(times, errors, endpoint, method) {
    const successful = times.filter(t => t.status >= 200 && t.status < 300);
    const elapsedArray = successful.map(t => t.elapsedMs).sort((a, b) => a - b);
    
    const count = elapsedArray.length;
    const sum = elapsedArray.reduce((a, b) => a + b, 0);
    const avg = count > 0 ? sum / count : 0;
    const min = count > 0 ? elapsedArray[0] : 0;
    const max = count > 0 ? elapsedArray[count - 1] : 0;
    
    // Percentiles
    const p50 = count > 0 ? elapsedArray[Math.floor(count * 0.5)] : 0;
    const p95 = count > 0 ? elapsedArray[Math.floor(count * 0.95)] || max : 0;
    const p99 = count > 0 ? elapsedArray[Math.floor(count * 0.99)] || max : 0;
    
    // Status counts
    const statusCounts = {};
    times.forEach(t => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    });
    
    return {
      endpoint,
      method,
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests: times.length + errors.length,
        successful: count,
        failed: errors.length,
        successRate: ((count / (times.length + errors.length)) * 100).toFixed(2) + '%'
      },
      timing: {
        avg_ms: Number(avg.toFixed(2)),
        min_ms: min,
        max_ms: max,
        p50_ms: p50,
        p95_ms: p95,
        p99_ms: p99
      },
      statusCounts,
      errors: errors.length > 0 ? errors : undefined,
      rawData: times
    };
  }

  async runFullMeasurement() {
    console.log('🔬 REAL-TIME BACKEND MEASUREMENT');
    console.log('================================');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Time: ${new Date().toISOString()}\n`);
    
    // Check if backend is running
    try {
      await axios.get(`${BASE_URL}/api/health`, { timeout: 5000 });
      console.log('✅ Backend is running\n');
    } catch (error) {
      console.error('❌ Backend not available at', BASE_URL);
      console.log('Set BACKEND_URL env var or start the backend first');
      process.exit(1);
    }
    
    const results = {
      collected_at: new Date().toISOString(),
      base_url: BASE_URL,
      endpoints: {}
    };
    
    // Measure Health Check
    results.endpoints.health = await this.measureEndpoint('/api/health', 'GET', null, 30);
    
    // Measure Courses (public)
    results.endpoints.courses = await this.measureEndpoint('/api/courses', 'GET', null, 30);
    
    // Measure Categories
    results.endpoints.categories = await this.measureEndpoint('/api/categories', 'GET', null, 30);
    
    // Save results
    const outputFile = path.join(OUTPUT_DIR, `realtime_metrics_${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    
    console.log('\n📁 Results saved to:', outputFile);
    
    // Print summary
    this.printSummary(results);
    
    return results;
  }

  printSummary(results) {
    console.log('\n📊 SUMMARY');
    console.log('==========');
    
    Object.entries(results.endpoints).forEach(([name, data]) => {
      console.log(`\n${name.toUpperCase()}:`);
      console.log(`  Success Rate: ${data.summary.successRate}`);
      console.log(`  Avg: ${data.timing.avg_ms}ms`);
      console.log(`  P95: ${data.timing.p95_ms}ms`);
      console.log(`  P99: ${data.timing.p99_ms}ms`);
    });
  }
}

// Run if called directly
if (require.main === module) {
  const measurer = new RealtimeMetrics();
  measurer.runFullMeasurement().catch(console.error);
}

module.exports = RealtimeMetrics;

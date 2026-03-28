/**
 * Difficulty to CEFR level mapping utility
 * 
 * Easy -> A1/A2
 * Medium -> B1/B2
 * Hard -> C1/C2
 */

const difficultyToCefrMap = {
  easy: ['A1', 'A2'],
  medium: ['B1', 'B2'],
  hard: ['C1', 'C2'],
};

/**
 * Get random CEFR level based on difficulty
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @returns {string} CEFR level (A1, A2, B1, B2, C1, C2)
 */
function getCefrLevel(difficulty) {
  const levels = difficultyToCefrMap[difficulty] || difficultyToCefrMap.easy;
  // Randomly select one level from the range
  return levels[Math.floor(Math.random() * levels.length)];
}

/**
 * Map quiz difficulty to CEFR for question bank storage
 * @param {string} difficulty - Quiz difficulty level
 * @returns {string} CEFR level
 */
function mapQuizDifficultyToCefr(difficulty) {
  const normalized = difficulty?.toLowerCase() || 'medium';
  return getCefrLevel(normalized);
}

/**
 * Get CEFR range for difficulty
 * @param {string} difficulty 
 * @returns {string[]} Array of CEFR levels
 */
function getCefrRange(difficulty) {
  return difficultyToCefrMap[difficulty?.toLowerCase()] || difficultyToCefrMap.medium;
}

module.exports = {
  getCefrLevel,
  mapQuizDifficultyToCefr,
  getCefrRange,
  difficultyToCefrMap,
};

/**
 * Difficulty to generic level mapping utility
 * 
 * Easy -> beginner
 * Medium -> intermediate
 * Hard -> advanced
 */

const difficultyToLevelMap = {
  easy: ['beginner'],
  medium: ['intermediate'],
  hard: ['advanced'],
};

/**
 * Get generic level based on difficulty
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @returns {string} Generic level (beginner, intermediate, advanced)
 */
function getGenericLevel(difficulty) {
  const levels = difficultyToLevelMap[difficulty] || difficultyToLevelMap.easy;
  return levels[0];
}

/**
 * Map quiz difficulty to generic level
 * @param {string} difficulty - Quiz difficulty level
 * @returns {string} Generic level
 */
function mapQuizDifficultyToLevel(difficulty) {
  const normalized = difficulty?.toLowerCase() || 'medium';
  return getGenericLevel(normalized);
}

/**
 * Get level range for difficulty
 * @param {string} difficulty 
 * @returns {string[]} Array of levels
 */
function getLevelRange(difficulty) {
  return difficultyToLevelMap[difficulty?.toLowerCase()] || difficultyToLevelMap.medium;
}

module.exports = {
  getGenericLevel,
  mapQuizDifficultyToLevel,
  getLevelRange,
  difficultyToLevelMap,
};

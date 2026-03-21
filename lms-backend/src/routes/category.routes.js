const express = require('express');
const categoryController = require('../modules/category/category.controller');

const router = express.Router();

// Public categories list for FE (no auth required)
router.get('/', categoryController.getCategories);

module.exports = router;


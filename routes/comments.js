const express = require('express');
const router = express.Router();
const {
    getPostComments,
    createComment,
    deleteComment
} = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

// Get comments for a specific post
router.get('/post/:postId', getPostComments);

// Create a new comment
router.post('/post/:postId', protect, createComment);

// Delete a comment
router.delete('/:id', protect, deleteComment);

module.exports = router;

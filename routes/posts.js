const express = require('express');
const router = express.Router();
const {
    getUserPosts,
    getPostById,
    createPost,
    updateUserProfile,
    deletePost,
    getTrendingPosts,
    getFeaturedPosts,
    likePost
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

// User posts routes
router.get('/user/:userId', getUserPosts);

// Featured posts
router.get('/featured', getFeaturedPosts);

// Trending posts
router.get('/trending', getTrendingPosts);

// Post CRUD routes
router.route('/')
    .post(protect, createPost);

router.route('/:id')
    .get(getPostById)
    .delete(protect, deletePost);

// Like/Unlike post
router.put('/:id/like', protect, likePost);

// User profile update
router.put('/profile', protect, updateUserProfile);

module.exports = router;

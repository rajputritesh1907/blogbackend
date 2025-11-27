const Comment = require('../models/Comment');
const Post = require('../models/Post');

// @desc    Get all comments for a post
// @route   GET /api/comments/post/:postId
// @access  Public
const getPostComments = async (req, res) => {
    try {
        // First get top-level comments
        const topLevelComments = await Comment.find({
            post: req.params.postId,
            parent: null // Only top-level comments
        })
        .populate('user', 'name avatar_url')
        .sort({ created_at: 1 });

        // Then get replies for each top-level comment
        const commentsWithReplies = await Promise.all(
            topLevelComments.map(async (comment) => {
                const replies = await Comment.find({
                    parent: comment._id
                })
                .populate('user', 'name avatar_url')
                .sort({ created_at: 1 });

                return {
                    ...comment.toObject(),
                    replies: replies
                };
            })
        );

        res.json(commentsWithReplies);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a comment
// @route   POST /api/comments/post/:postId
// @access  Private
const createComment = async (req, res) => {
    try {
        const { content, parentId } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Comment content is required' });
        }

        // Check if post exists
        const post = await Post.findById(req.params.postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const commentData = {
            post: req.params.postId,
            user: req.user._id,
            content: content.trim(),
            parent: parentId || null
        };

        const comment = await Comment.create(commentData);

        // Populate user data for response
        await comment.populate('user', 'name avatar_url');

        res.status(201).json(comment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Check if user owns the comment
        if (comment.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized to delete this comment' });
        }

        // Delete comment and all its replies
        await Comment.deleteMany({
            $or: [
                { _id: req.params.id },
                { parent: req.params.id }
            ]
        });

        res.json({ message: 'Comment removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPostComments,
    createComment,
    deleteComment
};

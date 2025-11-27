const Post = require('../models/Post');
const User = require('../models/User');

// @desc    Get all posts by a user
// @route   GET /api/posts/user/:userId
// @access  Private
const getUserPosts = async (req, res) => {
    try {
        const posts = await Post.find({
            author: req.params.userId,
            status: 'published'
        })
            .populate('author', 'name avatar_url')
            .sort({ created_at: -1 });

        const postsWithStats = posts.map(post => ({
            id: post._id,
            title: post.title,
            content: post.excerpt || post.content_html.substring(0, 200) + '...',
            createdAt: post.created_at,
            tags: post.tags,
            author: post.author.name,
            authorId: post.author._id,
            readTime: Math.ceil(post.content_html.split(' ').length / 200), // Rough estimate
            likes: post.likes.length,
            comments: 0, // TODO: Implement comments system
            coverImage: post.cover_image || `https://picsum.photos/400/250?random=${post._id.toString().slice(-6)}`
        }));

        res.json(postsWithStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Public
const getPostById = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('author', 'name avatar_url bio');

        if (post) {
            // Increment view count
            post.views += 1;
            await post.save();

            // Check if current user has liked this post (if authenticated)
            let userHasLiked = false;
            if (req.user) {
                userHasLiked = post.likes.includes(req.user._id);
            }

            res.json({
                id: post._id,
                title: post.title,
                content: post.content_html,
                excerpt: post.excerpt,
                coverImage: post.cover_image,
                author: post.author,
                tags: post.tags,
                category: post.category,
                views: post.views,
                likes: post.likes.length,
                userHasLiked: userHasLiked,
                createdAt: post.created_at,
                updatedAt: post.updated_at
            });
        } else {
            res.status(404).json({ message: 'Post not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a post
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res) => {
    try {
        const { title, content, tags, images, excerpt, coverImage } = req.body;

        // Create slug from title
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        const post = await Post.create({
            title,
            slug,
            content_html: content,
            excerpt,
            cover_image: coverImage,
            author: req.user._id,
            tags: tags || [],
            status: 'published' // Auto-publish for now
        });

        if (post) {
            res.status(201).json({
                id: post._id,
                title: post.title,
                slug: post.slug,
                createdAt: post.created_at
            });
        } else {
            res.status(400).json({ message: 'Invalid post data' });
        }
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ message: 'A post with this title already exists' });
        } else {
            res.status(500).json({ message: error.message });
        }
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.bio = req.body.bio || user.bio;

            if (req.body.avatar) {
                user.avatar_url = req.body.avatar;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                bio: updatedUser.bio,
                avatar_url: updatedUser.avatar_url,
                role: updatedUser.role
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get trending posts
// @route   GET /api/posts/trending
// @access  Public
const getTrendingPosts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 4;

        // Get all published posts to calculate trending scores
        const allPosts = await Post.find({ status: 'published' })
            .populate('author', 'name avatar_url');

        // Calculate trending score for each post
        // Score = (views * 1) + (likes * 3) + (age_penalty)
        // Higher score = more trending
        const postsWithScores = allPosts.map(post => {
            const now = new Date();
            const postDate = new Date(post.created_at);
            const hoursSincePosted = (now - postDate) / (1000 * 60 * 60);

            // Time decay: posts lose 0.1 points per hour after 24 hours
            const agePenalty = hoursSincePosted > 24 ? (hoursSincePosted - 24) * 0.1 : 0;

            // Weighted scoring: likes are 3x more valuable than views
            const trendingScore = (post.views * 1) + (post.likes.length * 3) - agePenalty;

            return {
                ...post.toObject(),
                trendingScore,
                hoursSincePosted
            };
        });

        // Sort by trending score (highest first), then by recency as tiebreaker
        const sortedPosts = postsWithScores
            .sort((a, b) => {
                if (b.trendingScore !== a.trendingScore) {
                    return b.trendingScore - a.trendingScore; // Higher score first
                }
                return new Date(b.created_at) - new Date(a.created_at); // Newer first as tiebreaker
            })
            .slice(0, limit);

        const trendingPosts = sortedPosts.map((post, index) => {
            return {
                id: post._id,
                rank: index + 1,
                title: post.title,
                excerpt: post.excerpt || post.content_html.substring(0, 100) + '...',
                coverImage: post.cover_image || `https://picsum.photos/400/250?random=${post._id.toString().slice(-6)}`,
                author: post.author.name,
                createdAt: post.created_at,
                readTime: Math.ceil(post.content_html.split(' ').length / 200), // Rough estimate
                likes: post.likes.length,
                views: post.views,
                trendingScore: Math.round(post.trendingScore * 100) / 100 // For debugging
            };
        });

        res.json(trendingPosts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get featured posts
// @route   GET /api/posts/featured
// @access  Public
const getFeaturedPosts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 3;

        // Get featured posts - most recent published posts
        const posts = await Post.find({ status: 'published' })
            .populate('author', 'name avatar_url')
            .sort({ created_at: -1 }) // Most recent first
            .limit(limit);

        const featuredPosts = posts.map(post => ({
            id: post._id,
            title: post.title,
            content: post.excerpt || post.content_html.substring(0, 200) + '...',
            coverImage: post.cover_image || `https://picsum.photos/400/250?random=${post._id.toString().slice(-6)}`,
            author: post.author.name,
            authorAvatar: post.author.avatar_url,
            createdAt: post.created_at,
            readTime: Math.ceil(post.content_html.split(' ').length / 200),
            likes: post.likes.length,
            views: post.views
        }));

        res.json(featuredPosts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Like/Unlike a post
// @route   PUT /api/posts/:id/like
// @access  Private
const likePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const userId = req.user._id;
        const isLiked = post.likes.includes(userId);

        if (isLiked) {
            // Unlike the post
            post.likes = post.likes.filter(id => id.toString() !== userId.toString());
        } else {
            // Like the post
            post.likes.push(userId);
        }

        await post.save();

        res.json({
            liked: !isLiked,
            likesCount: post.likes.length,
            message: isLiked ? 'Post unliked' : 'Post liked'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if user owns the post
        if (post.author.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized to delete this post' });
        }

        await Post.deleteOne({ _id: req.params.id });
        res.json({ message: 'Post removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getUserPosts,
    getPostById,
    createPost,
    updateUserProfile,
    deletePost,
    getTrendingPosts,
    getFeaturedPosts,
    likePost
};


// Migration script to add position column and fix image handling
const databaseModule = require('../database');
const path = require('path');
const fs = require('fs');

function addPositionColumn() {
    console.log('Adding position column to blog_post_images table...');
    
    // First, check if position column already exists
    databaseModule.db.get(
        "PRAGMA table_info(blog_post_images)",
        (err, result) => {
            if (err) {
                console.error('Error checking table structure:', err);
                return;
            }
            
            // Add position column if it doesn't exist
            databaseModule.db.run(
                `ALTER TABLE blog_post_images ADD COLUMN position INTEGER DEFAULT 0`,
                (err) => {
                    if (err && !err.message.includes('duplicate column')) {
                        console.error('Error adding position column:', err);
                    } else {
                        console.log('Position column added successfully');
                        fixImagePositions();
                    }
                }
            );
        }
    );
}

function fixImagePositions() {
    console.log('Fixing image positions...');
    
    // Get all posts with images
    databaseModule.db.all(
        `SELECT DISTINCT post_id FROM blog_post_images ORDER BY post_id`,
        (err, posts) => {
            if (err) {
                console.error('Error fetching posts with images:', err);
                return;
            }
            
            let processedPosts = 0;
            const totalPosts = posts.length;
            
            if (totalPosts === 0) {
                console.log('No posts with images found');
                return;
            }
            
            posts.forEach(post => {
                // Get images for this post ordered by creation time
                databaseModule.db.all(
                    `SELECT id, filename FROM blog_post_images 
                     WHERE post_id = ? 
                     ORDER BY created_at ASC`,
                    [post.post_id],
                    (err, images) => {
                        if (err) {
                            console.error(`Error fetching images for post ${post.post_id}:`, err);
                            processedPosts++;
                            return;
                        }
                        
                        // Update position for each image
                        let updatedImages = 0;
                        images.forEach((image, index) => {
                            const position = index + 1;
                            
                            databaseModule.db.run(
                                `UPDATE blog_post_images SET position = ? WHERE id = ?`,
                                [position, image.id],
                                (err) => {
                                    if (err) {
                                        console.error(`Error updating position for image ${image.filename}:`, err);
                                    } else {
                                        console.log(`Updated position for image ${image.filename} to ${position}`);
                                    }
                                    
                                    updatedImages++;
                                    if (updatedImages === images.length) {
                                        processedPosts++;
                                        if (processedPosts === totalPosts) {
                                            console.log('Migration completed successfully!');
                                            process.exit(0);
                                        }
                                    }
                                }
                            );
                        });
                    }
                );
            });
        }
    );
}

// Start migration
console.log('Starting image position migration...');
addPositionColumn();

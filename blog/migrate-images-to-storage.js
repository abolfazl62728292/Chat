
const fs = require('fs');
const path = require('path');

const migrateImagesToStorage = () => {
    const oldImagesPath = path.join(process.cwd(), 'blog/uploads/images');
    const newImagesPath = path.join(process.cwd(), 'storage', 'uploads', 'blog_images');
    
    console.log('🔄 Starting blog images migration...');
    
    // Create new directory if it doesn't exist
    if (!fs.existsSync(newImagesPath)) {
        fs.mkdirSync(newImagesPath, { recursive: true });
        console.log('📁 Created new storage directory:', newImagesPath);
    }
    
    // Check if old directory exists
    if (!fs.existsSync(oldImagesPath)) {
        console.log('ℹ️ No old images directory found. Migration complete.');
        return;
    }
    
    // Read files from old directory
    const files = fs.readdirSync(oldImagesPath);
    const imageFiles = files.filter(file => {
        return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file);
    });
    
    if (imageFiles.length === 0) {
        console.log('ℹ️ No image files found to migrate.');
        return;
    }
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    imageFiles.forEach(filename => {
        const oldFilePath = path.join(oldImagesPath, filename);
        const newFilePath = path.join(newImagesPath, filename);
        
        // Check if file already exists in new location
        if (fs.existsSync(newFilePath)) {
            console.log(`⏭️ Skipping ${filename} (already exists in storage)`);
            skippedCount++;
            return;
        }
        
        try {
            // Copy file to new location
            fs.copyFileSync(oldFilePath, newFilePath);
            console.log(`✅ Migrated: ${filename}`);
            migratedCount++;
        } catch (error) {
            console.error(`❌ Error migrating ${filename}:`, error.message);
        }
    });
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Migrated: ${migratedCount} files`);
    console.log(`   ⏭️ Skipped: ${skippedCount} files`);
    console.log(`   📁 New location: ${newImagesPath}`);
    
    if (migratedCount > 0) {
        console.log(`\n⚠️ Note: Original files are still in ${oldImagesPath}`);
        console.log(`   You can safely delete them after verifying the migration was successful.`);
    }
};

// Run migration if this file is executed directly
if (require.main === module) {
    migrateImagesToStorage();
}

module.exports = migrateImagesToStorage;

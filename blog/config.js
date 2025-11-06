const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// استفاده از مسیر ثابت storage برای بلاگ
const STORAGE_BASE_PATH = path.join(process.cwd(), 'storage', 'uploads');

// Function to generate filename with user input and uniqueness
function generateFilename(originalname, customName = null) {
    const ext = path.extname(originalname);
    const uploadPath = path.join(STORAGE_BASE_PATH, 'blog_images');

    let baseName;
    if (customName && customName.trim()) {
        // Clean custom name - remove extension if user added it, sanitize
        baseName = customName.replace(/\.[^/.]+$/, "").replace(/[^\u0600-\u06FF\w\s-]/g, '').trim();
        if (!baseName) {
            baseName = path.basename(originalname, ext);
        }
    } else {
        baseName = path.basename(originalname, ext);
    }

    let filename = baseName + ext;
    let counter = 1;

    // Check for existing files and add number if needed
    while (fs.existsSync(path.join(uploadPath, filename))) {
        filename = `${baseName}${counter}${ext}`;
        counter++;
    }

    return filename;
}

// Function to optimize and compress images
async function optimizeImage(inputPath, outputPath, filename) {
    try {
        const ext = path.extname(filename).toLowerCase();
        let pipeline = sharp(inputPath);
        
        // Get image metadata
        const metadata = await pipeline.metadata();
        
        // Resize if image is too large (max width: 1920px, max height: 1080px)
        if (metadata.width > 1920 || metadata.height > 1080) {
            pipeline = pipeline.resize(1920, 1080, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }
        
        // Apply format-specific optimization
        if (ext === '.jpg' || ext === '.jpeg') {
            pipeline = pipeline.jpeg({ 
                quality: 85, 
                progressive: true,
                mozjpeg: true 
            });
        } else if (ext === '.png') {
            pipeline = pipeline.png({ 
                quality: 90,
                compressionLevel: 8,
                progressive: true
            });
        } else if (ext === '.webp') {
            pipeline = pipeline.webp({ 
                quality: 85,
                effort: 6
            });
        }
        
        // Save optimized image
        await pipeline.toFile(outputPath);
        
        // Get file sizes for comparison
        const originalSize = fs.statSync(inputPath).size;
        const optimizedSize = fs.statSync(outputPath).size;
        const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
        
        console.log(`📸 Image optimized: ${filename}`);
        console.log(`   Original: ${(originalSize / 1024).toFixed(1)}KB`);
        console.log(`   Optimized: ${(optimizedSize / 1024).toFixed(1)}KB`);
        console.log(`   Savings: ${savings}%`);
        
        return { success: true, savings, originalSize, optimizedSize };
    } catch (error) {
        console.error('❌ Image optimization failed:', error);
        // If optimization fails, just copy the original file
        fs.copyFileSync(inputPath, outputPath);
        return { success: false, error: error.message };
    }
}

// Setup multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(STORAGE_BASE_PATH, 'blog_images');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Use custom name if provided in request body, otherwise generate unique name
        const customName = req.body.customFileName;
        const filename = generateFilename(file.originalname, customName);
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('فقط فایل‌های تصویری مجاز هستند'), false);
        }
    }
});

module.exports = {
    upload,
    generateFilename,
    optimizeImage,
    STORAGE_BASE_PATH
};
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const path = require('path');

class LiaraStorage {
    constructor() {
        // Check if Object Storage is configured
        this.isConfigured = !!(
            process.env.LIARA_ENDPOINT && 
            process.env.LIARA_ACCESS_KEY && 
            process.env.LIARA_SECRET_KEY && 
            process.env.LIARA_BUCKET_NAME
        );

        if (this.isConfigured) {
            this.client = new S3Client({
                region: "default",
                endpoint: process.env.LIARA_ENDPOINT,
                credentials: {
                    accessKeyId: process.env.LIARA_ACCESS_KEY,
                    secretAccessKey: process.env.LIARA_SECRET_KEY
                },
            });
            
            this.bucketName = process.env.LIARA_BUCKET_NAME;
            console.log('☁️ Liara Object Storage configured');
        } else {
            console.log('⚠️ Liara Object Storage not configured, using local storage');
        }
    }

    async uploadFile(fileBuffer, fileName, contentType = 'application/octet-stream') {
        if (!this.isConfigured) {
            throw new Error('Object Storage not configured');
        }

        try {
            const key = `uploads/${Date.now()}_${fileName}`;
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: contentType
            });

            const result = await this.client.send(command);
            
            // Return the URL to access the file
            const fileUrl = `${process.env.LIARA_ENDPOINT}/${this.bucketName}/${key}`;
            
            return {
                success: true,
                key: key,
                url: fileUrl,
                result: result
            };
        } catch (error) {
            console.error('Error uploading to Object Storage:', error);
            throw error;
        }
    }

    async uploadPanoramaImage(fileBuffer, userId, requestId, fileName) {
        if (!this.isConfigured) {
            throw new Error('Object Storage not configured');
        }

        try {
            const key = `panorama/${userId}/${requestId}/${fileName}`;
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: 'image/jpeg'
            });

            const result = await this.client.send(command);
            
            // Return the URL to access the file
            const fileUrl = `${process.env.LIARA_ENDPOINT}/${this.bucketName}/${key}`;
            
            return {
                success: true,
                key: key,
                url: fileUrl,
                result: result
            };
        } catch (error) {
            console.error('Error uploading panorama image:', error);
            throw error;
        }
    }

    async getSignedUrl(key, expiresIn = 3600) {
        if (!this.isConfigured) {
            throw new Error('Object Storage not configured');
        }

        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
            return signedUrl;
        } catch (error) {
            console.error('Error generating signed URL:', error);
            throw error;
        }
    }

    async deleteFile(key) {
        if (!this.isConfigured) {
            throw new Error('Object Storage not configured');
        }

        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const result = await this.client.send(command);
            return {
                success: true,
                result: result
            };
        } catch (error) {
            console.error('Error deleting from Object Storage:', error);
            throw error;
        }
    }

    // Fallback to local storage if Object Storage is not configured
    getLocalUploadPath() {
        const uploadsPath = process.env.UPLOADS_PATH || path.join(process.cwd(), 'storage', 'uploads');
        return uploadsPath;
    }

    isObjectStorageAvailable() {
        return this.isConfigured;
    }
}

module.exports = new LiaraStorage();
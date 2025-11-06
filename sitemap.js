const fs = require('fs');
const path = require('path');
const databaseModule = require('./database');

class SitemapGenerator {
    constructor() {
        this.baseUrl = process.env.BASE_URL || 'https://ai.za2.ir';
        this.db = databaseModule;
        // NO CACHE SYSTEM! FRESH DATABASE QUERIES EVERY TIME!
    }

    /**
     * Get the current timestamp in ISO format
     */
    getCurrentTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Convert Unix timestamp to ISO format
     */
    unixToISOString(unixTimestamp) {
        if (!unixTimestamp) return this.getCurrentTimestamp();
        
        // Check if timestamp is already in milliseconds (> 1e12) or seconds
        const timestamp = unixTimestamp > 1e12 ? unixTimestamp : unixTimestamp * 1000;
        
        // Create date and validate it's not in the future or too far in the past
        const date = new Date(timestamp);
        const now = new Date();
        
        // If date is invalid or in the future, use current time
        if (isNaN(date.getTime()) || date > now) {
            return this.getCurrentTimestamp();
        }
        
        // If date is too far in the past (before 2000), use current time
        if (date.getFullYear() < 2000) {
            return this.getCurrentTimestamp();
        }
        
        return date.toISOString();
    }

    /**
     * Escape XML special characters
     */
    escapeXml(text) {
        if (!text) return text;
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Generate XML URL entry
     */
    generateUrlEntry(loc, lastmod = null) {
        const escapedLoc = this.escapeXml(loc);
        let entry = `  <url>\n    <loc>${escapedLoc}</loc>\n`;
        
        if (lastmod) {
            const formattedDate = typeof lastmod === 'number' 
                ? this.unixToISOString(lastmod) 
                : lastmod;
            entry += `    <lastmod>${formattedDate}</lastmod>\n`;
        }
        
        entry += `  </url>\n`;
        return entry;
    }

    /**
     * Get static pages for sitemap
     */
    getStaticPages() {
        const staticPages = [
            { url: '/', lastmod: null },
            { url: '/sno', lastmod: null },
            { url: '/pano', lastmod: null },
            { url: '/sno-emb', lastmod: null },
            { url: '/blog', lastmod: null }
        ];

        return staticPages.map(page => 
            this.generateUrlEntry(`${this.baseUrl}${page.url}`, page.lastmod)
        ).join('');
    }

    /**
     * Get blog categories for sitemap
     */
    async getBlogCategoriesXml() {
        return new Promise((resolve, reject) => {
            // Check if method exists
            if (typeof this.db.getAllBlogCategories !== 'function') {
                console.log('ℹ️ getAllBlogCategories method not available, skipping categories');
                resolve('');
                return;
            }
            
            this.db.getAllBlogCategories((err, categories) => {
                if (err) {
                    console.error('Error fetching blog categories for sitemap:', err);
                    resolve(''); // Return empty string on error instead of failing
                    return;
                }

                if (!categories || categories.length === 0) {
                    resolve('');
                    return;
                }

                const categoriesXml = categories.map(category => {
                    const categoryUrl = `${this.baseUrl}/blog/category/${category.slug}`;
                    const lastmod = category.updated_at || category.created_at;
                    return this.generateUrlEntry(categoryUrl, lastmod);
                }).join('');

                resolve(categoriesXml);
            });
        });
    }

    /**
     * Get published blog posts for sitemap
     */
    async getBlogPostsXml() {
        return new Promise((resolve, reject) => {
            // Check if method exists
            if (typeof this.db.getAllBlogPostsWithDetails !== 'function') {
                console.log('ℹ️ getAllBlogPostsWithDetails method not available, skipping blog posts');
                resolve('');
                return;
            }
            
            this.db.getAllBlogPostsWithDetails((err, posts) => {
                if (err) {
                    console.error('Error fetching blog posts for sitemap:', err);
                    resolve(''); // Return empty string on error instead of failing
                    return;
                }

                if (!posts || posts.length === 0) {
                    resolve('');
                    return;
                }

                // Filter only published posts (is_published = 1)
                const publishedPosts = posts.filter(post => post.is_published === 1);
                
                if (publishedPosts.length === 0) {
                    console.log('ℹ️ No published blog posts found for sitemap');
                    resolve('');
                    return;
                }
                
                const postsXml = publishedPosts.map(post => {
                    // Create URL in format: /blog/:category/:slug (matching blog routes)
                    const postUrl = `${this.baseUrl}/blog/${post.category_slug}/${post.slug}`;
                    const lastmod = post.updated_at || post.created_at;
                    return this.generateUrlEntry(postUrl, lastmod);
                }).join('');

                resolve(postsXml);
            });
        });
    }

    /**
     * Generate complete sitemap XML
     */
    async generateSitemap() {
        try {
            console.log('🗺️ Generating sitemap.xml...');
            
            // XML header
            let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
            sitemapXml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

            // Add static pages
            sitemapXml += this.getStaticPages();

            // Add blog categories
            const categoriesXml = await this.getBlogCategoriesXml();
            sitemapXml += categoriesXml;

            // Add blog posts
            const postsXml = await this.getBlogPostsXml();
            sitemapXml += postsXml;

            // Close XML
            sitemapXml += `</urlset>\n`;

            console.log('✅ Sitemap generated successfully - FRESH FROM DATABASE');
            return sitemapXml;

        } catch (error) {
            console.error('❌ Error generating sitemap:', error);
            throw error;
        }
    }

    /**
     * Save sitemap to cache file
     */
    async saveSitemapToCache(xmlContent) {
        try {
            // Ensure storage directory exists
            const storageDir = path.dirname(this.cacheFile);
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }

            fs.writeFileSync(this.cacheFile, xmlContent, 'utf8');
            console.log(`💾 Sitemap cached to ${this.cacheFile}`);
        } catch (error) {
            console.error('❌ Error saving sitemap to cache:', error);
        }
    }

    /**
     * Check if cached sitemap exists and is still valid
     */
    isCacheValid() {
        try {
            if (!fs.existsSync(this.cacheFile)) {
                return false;
            }

            const stats = fs.statSync(this.cacheFile);
            const cacheAge = Date.now() - stats.mtime.getTime();
            
            return cacheAge < this.cacheExpiry;
        } catch (error) {
            console.error('❌ Error checking cache validity:', error);
            return false;
        }
    }

    /**
     * Get cached sitemap content
     */
    getCachedSitemap() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                return fs.readFileSync(this.cacheFile, 'utf8');
            }
        } catch (error) {
            console.error('❌ Error reading cached sitemap:', error);
        }
        return null;
    }

    /**
     * Get sitemap - NO CACHE! ALWAYS FRESH FROM DATABASE!
     */
    async getSitemap() {
        try {
            console.log('📋 Sitemap requested - generating fresh from database (NO CACHE)');
            const sitemapXml = await this.generateSitemap();
            return sitemapXml;
        } catch (error) {
            console.error('❌ Error getting sitemap:', error);
            // Return minimal sitemap as last resort
            return this.getMinimalSitemap();
        }
    }

    /**
     * Generate minimal sitemap with just static pages as fallback
     */
    getMinimalSitemap() {
        let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        sitemapXml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        sitemapXml += this.getStaticPages();
        sitemapXml += `</urlset>\n`;
        return sitemapXml;
    }

    /**
     * Force regenerate sitemap (for manual updates)
     */
    async regenerateSitemap() {
        console.log('🔄 Force regenerating sitemap...');
        return await this.getSitemap(true);
    }
}

// Export singleton instance
const sitemapGenerator = new SitemapGenerator();

module.exports = {
    SitemapGenerator,
    sitemapGenerator
};
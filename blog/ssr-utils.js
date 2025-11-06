const fs = require('fs');
const path = require('path');
const marked = require('marked');
const sanitizeHtml = require('sanitize-html');

// Configuration for HTML sanitization
const sanitizeConfig = {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre', 'figure', 'figcaption', 'div', 'span'],
    allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'width', 'height', 'class'],
        div: ['class'],
        span: ['class'],
        figure: ['class'],
        '*': ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedClasses: {
        '*': ['blog-image', 'blog-image-figure', 'text-center']
    },
    // Tighten style attribute sanitization - remove all style attributes
    allowedStyles: {}
};

// Helper function to escape HTML attributes
function escapeHtmlAttribute(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Helper function to escape HTML content
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// Helper function to sanitize HTML content
function sanitizeContent(html) {
    if (!html) return '';
    return sanitizeHtml(html, sanitizeConfig);
}

// Helper function to get base URL from request
function getBaseUrl(req) {
    if (!req) return 'https://example.com'; // Fallback for testing
    const protocol = req.protocol || (req.secure ? 'https' : 'http');
    const host = req.get('host') || req.hostname || 'localhost:3000';
    return `${protocol}://${host}`;
}

// Helper function to safely truncate text for excerpts
function safeTruncateText(text, maxLength = 500) {
    if (!text) return '';
    
    // Sanitize the text first
    const sanitizedText = sanitizeContent(text);
    
    // Remove HTML tags for accurate length calculation
    const textOnly = sanitizedText.replace(/<[^>]*>/g, '');
    
    if (textOnly.length <= maxLength) {
        return sanitizedText;
    }
    
    // Truncate the sanitized text safely
    let truncated = sanitizedText.substring(0, maxLength);
    
    // Make sure we don't break HTML tags
    const lastOpenTag = truncated.lastIndexOf('<');
    const lastCloseTag = truncated.lastIndexOf('>');
    
    if (lastOpenTag > lastCloseTag) {
        // We have an unclosed tag, truncate before it
        truncated = truncated.substring(0, lastOpenTag);
    }
    
    // Find the last complete word
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0 && lastSpace > truncated.length - 50) {
        truncated = truncated.substring(0, lastSpace);
    }
    
    return truncated + '...';
}

// Function to create post card HTML
function createPostCardHTML(post) {
    const date = new Date(post.created_at * 1000).toLocaleDateString("fa-IR");

    const imageHtml = post.main_image
        ? `<img src="/api/blog/images/${escapeHtmlAttribute(post.main_image)}" alt="${escapeHtmlAttribute(post.title)}" class="post-image">`
        : `<div class="post-image-placeholder"></div>`;

    // Use safeTruncateText for consistent excerpt handling (already sanitized)
    const excerpt = post.excerpt ? safeTruncateText(post.excerpt, 300) : safeTruncateText(post.content, 300);

    return `
        <a href="/blog/${escapeHtmlAttribute(post.category_slug)}/${escapeHtmlAttribute(post.slug)}" class="post-card">
            ${imageHtml}
            <div class="post-content">
                <div class="post-meta">
                    <span class="post-category">${escapeHtml(post.category_name)}</span>
                    <span>${escapeHtml(date)}</span>
                </div>
                <h2 class="post-title">${escapeHtml(post.title)}</h2>
                <p class="post-excerpt">${excerpt}</p>
                <div class="read-more">ادامه مطلب</div>
            </div>
        </a>
    `;
}

// Function to create categories HTML
function createCategoriesHTML(categories, currentCategory = '') {
    let html = '<a href="/blog" class="category-chip' + (currentCategory === '' ? ' active' : '') + '">همه مقالات</a>';

    // Use spread operator to avoid mutating input array
    [...categories].reverse().forEach((category) => {
        const isActive = currentCategory === category.slug ? ' active' : '';
        html += `<a href="/blog/category/${escapeHtmlAttribute(category.slug)}" class="category-chip${isActive}">${escapeHtml(category.name)}</a>`;
    });

    return html;
}

// Function to create pagination HTML
function createPaginationHTML(pagination, baseUrl = '/blog') {
    if (!pagination || pagination.pages <= 1) {
        return "";
    }

    const currentPage = pagination.page;
    const totalPages = pagination.pages;
    const safeBaseUrl = escapeHtmlAttribute(baseUrl);

    let html = '<div class="pagination">';

    // دکمه قبلی
    if (currentPage > 1) {
        const prevUrl = currentPage === 2 ? safeBaseUrl : `${safeBaseUrl}?page=${currentPage - 1}`;
        html += `<a href="${prevUrl}" class="pagination-btn">قبلی</a>`;
    } else {
        html += `<span class="pagination-btn disabled">قبلی</span>`;
    }

    // شماره صفحات
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<span class="pagination-btn active">${escapeHtml(i.toString())}</span>`;
        } else {
            const pageUrl = i === 1 ? safeBaseUrl : `${safeBaseUrl}?page=${i}`;
            html += `<a href="${pageUrl}" class="pagination-btn">${escapeHtml(i.toString())}</a>`;
        }
    }

    // دکمه بعدی
    if (currentPage < totalPages) {
        html += `<a href="${safeBaseUrl}?page=${currentPage + 1}" class="pagination-btn">بعدی</a>`;
    } else {
        html += `<span class="pagination-btn disabled">بعدی</span>`;
    }

    html += "</div>";
    return html;
}

// Function to render blog index with data
function renderBlogIndex(categories, posts, pagination, req = null) {
    const templatePath = path.join(__dirname, 'public', 'blog-index.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    const baseUrl = getBaseUrl(req);
    const indexUrl = `${baseUrl}/blog`;
    
    // Update SEO meta tags with dynamic URLs
    html = html.replace(/id=["']canonicalUrl["'][^>]*href=["'][^"']*["']/gi, `id="canonicalUrl" href="${escapeHtmlAttribute(indexUrl)}"`);    
    html = html.replace(/id=["']ogUrl["'][^>]*content=["'][^"']*["']/gi, `id="ogUrl" content="${escapeHtmlAttribute(indexUrl)}"`);    

    // Add structured data for blog index
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": "بلاگ ZaTwo AI",
        "description": "بلاگ رسمی زاتو ای آی - مطالعه آخرین مقالات، آموزش‌ها و اخبار مرتبط با هوش مصنوعی",
        "url": indexUrl,
        "mainEntityOfPage": indexUrl,
        "inLanguage": "fa-IR",
        "publisher": {
            "@type": "Organization",
            "name": "ZaTwo AI",
            "logo": {
                "@type": "ImageObject",
                "url": `${baseUrl}/Logo.png`
            },
            "url": baseUrl
        },
        "genre": ["Artificial Intelligence", "Technology", "Machine Learning"],
        "keywords": "هوش مصنوعی, AI, یادگیری ماشین, فناوری, مقالات, آموزش"
    };

    html = html.replace(
        /<script[^>]*id=["']blogIndexSchema["'][^>]*>[\s\S]*?<\/script>/,
        `<script type="application/ld+json" id="blogIndexSchema">${JSON.stringify(structuredData, null, 2)}</script>`
    );

    // Replace categories using robust ID-targeted replacement
    const categoriesHTML = createCategoriesHTML(categories);
    html = html.replace(
        /<div[^>]*id=["']categoriesContainer["'][^>]*>[\s\S]*?<\/div>/,
        `<div class="categories" id="categoriesContainer">
                ${categoriesHTML}
            </div>`
    );

    // Replace posts using robust ID-targeted replacement
    let postsHTML = '';
    if (posts && posts.length > 0) {
        const postsCardsHTML = posts.map(post => createPostCardHTML(post)).join("");
        postsHTML = `<div class="posts-grid">${postsCardsHTML}</div>`;
    } else {
        postsHTML = `
            <div class="empty-state">
                <h3>مقاله‌ای یافت نشد</h3>
                <p>هنوز مقاله‌ای منتشر نشده است</p>
            </div>
        `;
    }

    html = html.replace(
        /<div[^>]*id=["']postsContainer["'][^>]*>[\s\S]*?<\/div>/,
        `<div id="postsContainer">${postsHTML}</div>`
    );

    // Replace pagination using robust ID-targeted replacement
    const paginationHTML = createPaginationHTML(pagination);
    html = html.replace(
        /<div[^>]*id=["']paginationContainer["'][^>]*>[\s\S]*?<\/div>/,
        `<div id="paginationContainer">${paginationHTML}</div>`
    );

    return html;
}

// Function to render blog category page with data
function renderBlogCategory(category, categories, posts, pagination, req = null) {
    const templatePath = path.join(__dirname, 'public', 'blog-category.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    const baseUrl = getBaseUrl(req);
    const categoryUrl = `${baseUrl}/blog/category/${escapeHtmlAttribute(category.slug)}`;
    
    // Sanitize and escape category data
    const categoryTitle = `${escapeHtml(category.name)} - بلاگ ZaTwo AI`;
    const categoryDescription = escapeHtmlAttribute(category.description || `مقالات مربوط به ${category.name} در بلاگ زاتو ای آی`);

    // Robust title and meta replacements with ID-targeted updates
    html = html.replace(/id=["']pageTitle["'][^>]*>.*?<\/title>/i, `id="pageTitle">${categoryTitle}</title>`);
    html = html.replace(/id=["']pageDescription["'][^>]*content=["'][^"']*["']/gi, `id="pageDescription" content="${categoryDescription}"`);
    html = html.replace(/id=["']canonicalUrl["'][^>]*href=["'][^"']*["']/gi, `id="canonicalUrl" href="${escapeHtmlAttribute(categoryUrl)}"`);
    html = html.replace(/id=["']ogTitle["'][^>]*content=["'][^"']*["']/gi, `id="ogTitle" content="${escapeHtmlAttribute(categoryTitle)}"`);
    html = html.replace(/id=["']ogDescription["'][^>]*content=["'][^"']*["']/gi, `id="ogDescription" content="${categoryDescription}"`);
    html = html.replace(/id=["']ogUrl["'][^>]*content=["'][^"']*["']/gi, `id="ogUrl" content="${escapeHtmlAttribute(categoryUrl)}"`);
    html = html.replace(/id=["']twitterTitle["'][^>]*content=["'][^"']*["']/gi, `id="twitterTitle" content="${escapeHtmlAttribute(categoryTitle)}"`);
    html = html.replace(/id=["']twitterDescription["'][^>]*content=["'][^"']*["']/gi, `id="twitterDescription" content="${categoryDescription}"`);

    // Replace categories with current category active using robust targeting
    const categoriesHTML = createCategoriesHTML(categories, category.slug);
    html = html.replace(
        /<div[^>]*id=["']categoriesContainer["'][^>]*>[\s\S]*?<\/div>/,
        `<div class="categories" id="categoriesContainer">${categoriesHTML}</div>`
    );

    // Replace posts using robust ID-targeted replacement
    let postsHTML = '';
    if (posts && posts.length > 0) {
        const postsCardsHTML = posts.map(post => createPostCardHTML(post)).join("");
        postsHTML = `<div class="posts-grid">${postsCardsHTML}</div>`;
    } else {
        postsHTML = `
            <div class="empty-state">
                <h3>مقاله‌ای یافت نشد</h3>
                <p>در حال حاضر مقاله‌ای در این دسته‌بندی وجود ندارد</p>
            </div>
        `;
    }

    html = html.replace(
        /<div[^>]*id=["']postsContainer["'][^>]*>[\s\S]*?<\/div>/,
        `<div id="postsContainer">${postsHTML}</div>`
    );

    // Replace pagination with category-specific URLs using robust targeting
    const paginationBaseUrl = `/blog/category/${escapeHtmlAttribute(category.slug)}`;
    const paginationHTML = createPaginationHTML(pagination, paginationBaseUrl);
    html = html.replace(
        /<div[^>]*id=["']paginationContainer["'][^>]*>[\s\S]*?<\/div>/,
        `<div id="paginationContainer">${paginationHTML}</div>`
    );

    return html;
}

// Function to render blog post with data
function renderBlogPost(post, relatedPosts, req = null) {
    const templatePath = path.join(__dirname, 'public', 'blog-post.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    const baseUrl = getBaseUrl(req);
    const postUrl = `${baseUrl}/blog/${escapeHtmlAttribute(post.category_slug)}/${escapeHtmlAttribute(post.slug)}`;
    const postImageUrl = post.main_image ? `${baseUrl}/api/blog/images/${escapeHtmlAttribute(post.main_image)}` : `${baseUrl}/Logo.png`;
    const publishedDate = new Date(post.created_at * 1000).toISOString();
    const updatedDate = post.updated_at ? new Date(post.updated_at * 1000).toISOString() : publishedDate;

    // Sanitize post data for meta content
    const safeTitle = escapeHtmlAttribute(post.title);
    const safeMetaDescription = escapeHtmlAttribute(post.meta_description || post.excerpt || safeTruncateText(post.content, 160));
    const safeMetaKeywords = escapeHtmlAttribute(post.meta_keywords || 'هوش مصنوعی, AI, مقاله, آموزش');
    const safeCategoryName = escapeHtmlAttribute(post.category_name);
    
    // Update SEO meta tags using robust ID-targeted replacements
    html = html.replace(/id=["']pageTitle["'][^>]*>.*?<\/title>/i, `id="pageTitle">${safeTitle} - بلاگ ZaTwo AI</title>`);
    html = html.replace(/id=["']pageDescription["'][^>]*content=["'][^"']*["']/gi, `id="pageDescription" content="${safeMetaDescription}"`);
    html = html.replace(/id=["']pageKeywords["'][^>]*content=["'][^"']*["']/gi, `id="pageKeywords" content="${safeMetaKeywords}"`);
    html = html.replace(/id=["']canonicalUrl["'][^>]*href=["'][^"']*["']/gi, `id="canonicalUrl" href="${escapeHtmlAttribute(postUrl)}"`);

    // Update Open Graph tags using robust targeting
    html = html.replace(/id=["']ogTitle["'][^>]*content=["'][^"']*["']/gi, `id="ogTitle" content="${safeTitle}"`);
    html = html.replace(/id=["']ogDescription["'][^>]*content=["'][^"']*["']/gi, `id="ogDescription" content="${safeMetaDescription}"`);
    html = html.replace(/id=["']ogImage["'][^>]*content=["'][^"']*["']/gi, `id="ogImage" content="${escapeHtmlAttribute(postImageUrl)}"`);
    html = html.replace(/id=["']ogUrl["'][^>]*content=["'][^"']*["']/gi, `id="ogUrl" content="${escapeHtmlAttribute(postUrl)}"`);

    // Update Article meta tags using robust targeting
    html = html.replace(/id=["']articleAuthor["'][^>]*content=["'][^"']*["']/gi, `id="articleAuthor" content="ZaTwo AI"`);
    html = html.replace(/id=["']articlePublished["'][^>]*content=["'][^"']*["']/gi, `id="articlePublished" content="${escapeHtmlAttribute(publishedDate)}"`);
    html = html.replace(/id=["']articleModified["'][^>]*content=["'][^"']*["']/gi, `id="articleModified" content="${escapeHtmlAttribute(updatedDate)}"`);
    html = html.replace(/id=["']articleSection["'][^>]*content=["'][^"']*["']/gi, `id="articleSection" content="${safeCategoryName}"`);

    // Update Twitter tags using robust targeting
    html = html.replace(/id=["']twitterTitle["'][^>]*content=["'][^"']*["']/gi, `id="twitterTitle" content="${safeTitle}"`);
    html = html.replace(/id=["']twitterDescription["'][^>]*content=["'][^"']*["']/gi, `id="twitterDescription" content="${safeMetaDescription}"`);
    html = html.replace(/id=["']twitterImage["'][^>]*content=["'][^"']*["']/gi, `id="twitterImage" content="${escapeHtmlAttribute(postImageUrl)}"`);

    // Update breadcrumb using robust ID-targeted replacement
    html = html.replace(
        /<div[^>]*id=["']breadcrumb["'][^>]*>[\s\S]*?<\/div>/,
        `<div class="breadcrumb" id="breadcrumb">
            <a href="/blog">بلاگ</a>
            <span>›</span>
            <a href="/blog/category/${escapeHtmlAttribute(post.category_slug)}">${escapeHtml(post.category_name)}</a>
            <span>›</span>
            <span>${escapeHtml(post.title)}</span>
        </div>`
    );

    // Create post HTML content with proper sanitization
    const postDate = new Date(post.created_at * 1000).toLocaleDateString("fa-IR");
    const postImageHTML = post.main_image 
        ? `<img src="/api/blog/images/${escapeHtmlAttribute(post.main_image)}" alt="${escapeHtmlAttribute(post.title)}" class="post-featured-image">`
        : '';

    // Sanitize post content
    const sanitizedContent = sanitizeContent(post.content_html || marked.parse(post.content));
    const sanitizedExcerpt = post.excerpt ? sanitizeContent(post.excerpt) : '';

    const postHTML = `
        <article class="post">
            <header class="post-header">
                <div class="post-meta">
                    <a href="/blog/category/${escapeHtmlAttribute(post.category_slug)}" class="post-category">${escapeHtml(post.category_name)}</a>
                    <time datetime="${escapeHtmlAttribute(publishedDate)}">${escapeHtml(postDate)}</time>
                </div>
                <h1 class="post-title">${escapeHtml(post.title)}</h1>
                ${sanitizedExcerpt ? `<div class="post-excerpt">${sanitizedExcerpt}</div>` : ''}
            </header>
            ${postImageHTML}
            <div class="post-body" id="post-body">
                ${sanitizedContent}
            </div>
        </article>
    `;

    // Replace post container using robust ID-targeted replacement
    html = html.replace(
        /<div[^>]*id=["']postContainer["'][^>]*>[\s\S]*?<\/div>/,
        `<div id="postContainer">${postHTML}</div>`
    );

    // Add related posts if available with proper sanitization
    if (relatedPosts && (relatedPosts.readMore?.length > 0 || relatedPosts.related?.length > 0)) {
        let relatedHTML = '<div class="related-posts"><h3>مقالات مرتبط</h3><div class="related-posts-grid">';
        
        const allRelated = [...(relatedPosts.related || []), ...(relatedPosts.readMore || [])];
        allRelated.slice(0, 3).forEach(relatedPost => {
            const relatedDate = new Date(relatedPost.created_at * 1000).toLocaleDateString("fa-IR");
            const relatedImageHTML = relatedPost.main_image 
                ? `<img src="/api/blog/images/${escapeHtmlAttribute(relatedPost.main_image)}" alt="${escapeHtmlAttribute(relatedPost.title)}" class="related-post-image">`
                : '<div class="related-post-image-placeholder"></div>';
            
            relatedHTML += `
                <a href="/blog/${escapeHtmlAttribute(relatedPost.category_slug)}/${escapeHtmlAttribute(relatedPost.slug)}" class="related-post-card">
                    ${relatedImageHTML}
                    <div class="related-post-content">
                        <span class="related-post-category">${escapeHtml(relatedPost.category_name)}</span>
                        <h4 class="related-post-title">${escapeHtml(relatedPost.title)}</h4>
                        <span class="related-post-date">${escapeHtml(relatedDate)}</span>
                    </div>
                </a>
            `;
        });
        
        relatedHTML += '</div></div>';
        
        html = html.replace(
            /<div[^>]*id=["']relatedPostsContainer["'][^>]*>[\s\S]*?<\/div>/,
            `<div id="relatedPostsContainer">${relatedHTML}</div>`
        );
    }

    // Add structured data with dynamic base URL and sanitized content
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.meta_description || post.excerpt || safeTruncateText(post.content, 160),
        "image": postImageUrl,
        "author": {
            "@type": "Organization",
            "name": "ZaTwo AI",
            "url": baseUrl
        },
        "publisher": {
            "@type": "Organization",
            "name": "ZaTwo AI",
            "logo": {
                "@type": "ImageObject",
                "url": `${baseUrl}/Logo.png`
            },
            "url": baseUrl
        },
        "datePublished": publishedDate,
        "dateModified": updatedDate,
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": postUrl
        },
        "url": postUrl,
        "articleSection": post.category_name,
        "keywords": post.meta_keywords || 'هوش مصنوعی, AI, مقاله, آموزش',
        "inLanguage": "fa-IR"
    };

    html = html.replace(
        /<script[^>]*id=["']blogPostSchema["'][^>]*>[\s\S]*?<\/script>/,
        `<script type="application/ld+json" id="blogPostSchema">${JSON.stringify(structuredData, null, 2)}</script>`
    );

    return html;
}

module.exports = {
    renderBlogIndex,
    renderBlogCategory,
    renderBlogPost,
    safeTruncateText,
    createPostCardHTML,
    createCategoriesHTML,
    createPaginationHTML
};
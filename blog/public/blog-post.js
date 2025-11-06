
// استخراج اطلاعات از URL
const pathParts = window.location.pathname.split('/');
const categorySlug = pathParts[2];
const postSlug = pathParts[3];

let currentPost = null;

// بارگیری مقاله
async function loadPost() {
    try {
        const response = await fetch(`/api/blog/posts/${categorySlug}/${postSlug}`);
        
        if (!response.ok) {
            if (response.status === 401) {
                displayError('لطفاً وارد شوید');
                return;
            }
            if (response.status === 404) {
                displayError('مقاله یافت نشد');
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.success) {
            currentPost = data.post;
            displayPost(currentPost);
            updateSEO(currentPost);
            updateBreadcrumb(currentPost);

            // نمایش مقالات مرتبط اگر موجود باشد
            if (currentPost.relatedPosts && 
                (currentPost.relatedPosts.readMore.length > 0 || currentPost.relatedPosts.related.length > 0)) {
                displayRelatedPosts(currentPost.relatedPosts);
            }
        } else {
            displayError('مقاله یافت نشد');
        }
    } catch (error) {
        console.error('خطا در بارگیری مقاله:', error);
        displayError('خطا در بارگیری مقاله');
    }
}

function createExpandableExcerpt(excerpt) {
    if (!excerpt) return '';
    
    const maxLength = 200;
    if (excerpt.length <= maxLength) {
        return `<p class="post-excerpt" itemprop="description">${excerpt}</p>`;
    }
    
    const truncatedExcerpt = excerpt.substring(0, maxLength);
    const remainingExcerpt = excerpt.substring(maxLength);
    
    return `
        <div class="post-excerpt-container" itemprop="description">
            <p class="post-excerpt">
                <span class="excerpt-visible">${truncatedExcerpt}...</span>
                <span class="excerpt-hidden" style="display: none;">${remainingExcerpt}</span>
            </p>
            <button class="excerpt-toggle" onclick="toggleExcerpt()">ادامه</button>
        </div>
    `;
}

function displayPost(post) {
    const container = document.getElementById('postContainer');
    const date = new Date(post.created_at * 1000).toLocaleDateString('fa-IR');

    // Clean up content HTML to prevent conflicts
    let cleanContent = post.content_html;
    if (cleanContent) {
        // Remove any unwanted newlines around images
        cleanContent = cleanContent.replace(/\n\s*<figure/g, '<figure');
        cleanContent = cleanContent.replace(/<\/figure>\s*\n/g, '</figure>');
        // Fix paragraph tags around images
        cleanContent = cleanContent.replace(/<p>\s*<figure/g, '<figure');
        cleanContent = cleanContent.replace(/<\/figure>\s*<\/p>/g, '</figure>');

        // Wrap standalone images in blog-image-container and blog-image-figure
        cleanContent = cleanContent.replace(/<img([^>]*)>/g, (match, attributes) => {
            // Check if the image is already within a figure or a custom container
            const isAlreadyWrapped = cleanContent.substring(0, cleanContent.indexOf('<img')).trim().endsWith('>') && 
                                     cleanContent.substring(cleanContent.indexOf('<img')).indexOf('</figure>') === -1;
            
            if (!isAlreadyWrapped) {
                // Check if it's already inside a figure
                const imgIndex = cleanContent.indexOf('<img');
                let tempContent = cleanContent.substring(0, imgIndex);
                let openFigureCount = (tempContent.match(/<figure/g) || []).length;
                let closeFigureCount = (tempContent.match(/<\/figure>/g) || []).length;

                if (openFigureCount > closeFigureCount) {
                    // Already inside a figure, just return the img tag
                    return match;
                } else {
                    // Wrap it in the new structure
                    return `<div class="blog-image-container"><figure class="blog-image-figure"><img ${attributes}></figure></div>`;
                }
            }
            return match; // Return the original match if already wrapped
        });
    }

    container.innerHTML = `
        <article itemscope itemtype="https://schema.org/BlogPosting">
            <header class="post-header">
                <h2 class="post-title" itemprop="headline">${post.title}</h2>
                ${post.excerpt ? createExpandableExcerpt(post.excerpt) : (post.content ? createExpandableExcerpt(post.content.substring(0, 1000)) : '')}
                <div class="post-meta">
                    <div class="meta-item">
                        <time datetime="${new Date(post.created_at * 1000).toISOString()}" itemprop="datePublished">
                            تاریخ: ${date}
                        </time>
                    </div>
                    <div class="meta-item">
                        <span itemprop="articleSection">دسته‌بندی: ${post.category_name}</span>
                    </div>
                    <div class="meta-item" style="display: none;">
                        <span itemprop="author" itemscope itemtype="https://schema.org/Organization">
                            <span itemprop="name">ZaTwo AI</span>
                        </span>
                        <span itemprop="publisher" itemscope itemtype="https://schema.org/Organization">
                            <span itemprop="name">ZaTwo AI</span>
                        </span>
                    </div>
                </div>
            </header>

            <section class="post-content">
                <div class="post-body" itemprop="articleBody">${cleanContent}</div>
            </section>
        </article>
    `;

    // اعمال syntax highlighting
    if (typeof Prism !== 'undefined') {
        Prism.highlightAllUnder(container);
    }

    // Implement lazy loading and prevent CLS for images
    const images = container.querySelectorAll('.post-body img');
    images.forEach(img => {
        // Add lazy loading for better performance
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');

        // Prevent CLS by setting default dimensions if they are not set
        if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
            // If the image is inside our custom container, we don't need to set aspect-ratio here
            if (!img.closest('.blog-image-container')) {
                img.style.aspectRatio = '16 / 9'; // Default aspect ratio
            }
        }

        // Handle load event for smooth appearance
        img.addEventListener('load', function() {
            this.classList.add('loaded');
            // Remove aspect ratio once loaded if it was set for CLS
            if (this.style.aspectRatio === '16 / 9') {
                this.style.aspectRatio = 'auto';
            }
        });

        // Handle error for broken images
        img.addEventListener('error', function() {
            // If the image is within our custom structure, hide the container
            const imageContainer = this.closest('.blog-image-container');
            if (imageContainer) {
                imageContainer.style.display = 'none';
            } else {
                // Otherwise, hide the image itself
                this.style.display = 'none';
            }
        });
    });
}

function updateSEO(post) {
    // عنوان صفحه
    const fullTitle = post.title + ' - بلاگ ZaTwo AI';
    document.title = fullTitle;
    document.getElementById('pageTitle').content = fullTitle;

    // توضیحات متا
    const description = post.meta_description || post.excerpt || (post.content ? post.content.substring(0, 160) + '...' : '');
    document.getElementById('pageDescription').content = description;

    // کلمات کلیدی
    if (post.meta_keywords) {
        document.getElementById('pageKeywords').content = post.meta_keywords;
    }

    // Canonical URL
    const currentUrl = window.location.href;
    document.getElementById('canonicalUrl').href = currentUrl;

    // Open Graph
    document.getElementById('ogTitle').content = post.title;
    document.getElementById('ogDescription').content = description;
    document.getElementById('ogUrl').content = currentUrl;
    document.getElementById('articleSection').content = post.category_name;
    document.getElementById('articleAuthor').content = 'ZaTwo AI';

    // Article dates
    const publishedDate = new Date(post.created_at * 1000).toISOString();
    const modifiedDate = new Date(post.updated_at * 1000).toISOString();
    document.getElementById('articlePublished').content = publishedDate;
    document.getElementById('articleModified').content = modifiedDate;

    // Twitter
    document.getElementById('twitterTitle').content = post.title;
    document.getElementById('twitterDescription').content = description;

    // تصویر اصلی
    let imageUrl = '/favicon.ico';
    if (post.images && post.images.length > 0) {
        const mainImage = post.images.find(img => img.is_main) || post.images[0];
        if (mainImage && mainImage.filename) {
            imageUrl = window.location.origin + `/api/blog/images/${mainImage.filename}`;
        }
    }
    document.getElementById('ogImage').content = imageUrl;
    document.getElementById('twitterImage').content = imageUrl;

    // JSON-LD Structured Data
    createBlogPostSchema(post, imageUrl, currentUrl, publishedDate, modifiedDate);
}

function createBlogPostSchema(post, imageUrl, currentUrl, publishedDate, modifiedDate) {
    const schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": currentUrl,
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": currentUrl
        },
        "headline": post.title,
        "name": post.title,
        "description": post.meta_description || post.excerpt || (post.content ? post.content.substring(0, 160) + '...' : ''),
        "image": [imageUrl],
        "datePublished": publishedDate,
        "dateModified": modifiedDate,
        "author": {
            "@type": "Organization",
            "@id": window.location.origin,
            "name": "ZaTwo AI",
            "url": window.location.origin
        },
        "publisher": {
            "@type": "Organization",
            "@id": window.location.origin,
            "name": "ZaTwo AI",
            "logo": {
                "@type": "ImageObject",
                "url": window.location.origin + "/favicon.ico",
                "width": 60,
                "height": 60
            },
            "url": window.location.origin
        },
        "articleSection": post.category_name,
        "inLanguage": "fa-IR",
        "isAccessibleForFree": true,
        "wordCount": post.content ? post.content.split(/\s+/).filter(Boolean).length : 0,
        "url": currentUrl
    };

    // Add keywords if available
    if (post.meta_keywords) {
        schema.keywords = post.meta_keywords.split(',').map(k => k.trim()).filter(Boolean);
    }

    // Update the JSON-LD script
    document.getElementById('blogPostSchema').textContent = JSON.stringify(schema);
}

function updateBreadcrumb(post) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!post || !post.category_slug || !post.category_name || !post.title) {
        // If post data is incomplete, keep the default breadcrumb
        return;
    }
    breadcrumb.innerHTML = `
        <a href="/blog">بلاگ</a>
        <span>»</span>
        <a href="/blog/category/${post.category_slug}">${post.category_name}</a>
        <span>»</span>
        <span>${post.title}</span>
    `;
}

function displayRelatedPosts(relatedData) {
    const container = document.getElementById('relatedPostsContainer');

    function createPostHtml(post) {
        const imageHtml = post.main_image 
            ? `<img src="/api/blog/images/${post.main_image}" alt="${post.title}" class="related-post-image" loading="lazy">`
            : `<div class="related-post-placeholder"></div>`;

        return `
            <a href="/blog/${post.category_slug}/${post.slug}" class="related-post">
                ${imageHtml}
                <div class="related-post-content">
                    <h4 class="related-post-title">${post.title}</h4>
                </div>
            </a>
        `;
    }

    let sectionsHtml = '';

    // بخش "بیشتر بخوانید"
    if (relatedData.readMore && relatedData.readMore.length > 0) {
        const readMoreHtml = relatedData.readMore.map(createPostHtml).join('');
        sectionsHtml += `
            <div class="related-section">
                <h3>بیشتر بخوانید</h3>
                <div class="related-posts-grid">
                    ${readMoreHtml}
                </div>
            </div>
        `;
    }

    // بخش "موارد مرتبط"
    if (relatedData.related && relatedData.related.length > 0) {
        const relatedHtml = relatedData.related.map(createPostHtml).join('');
        sectionsHtml += `
            <div class="related-section">
                <h3> موارد مرتبط</h3>
                <div class="related-posts-grid">
                    ${relatedHtml}
                </div>
            </div>
        `;
    }

    if (sectionsHtml) {
        container.innerHTML = `
            <div class="related-posts">
                ${sectionsHtml}
            </div>
        `;
    }
}

function displayError(message) {
    const container = document.getElementById('postContainer');
    container.innerHTML = `
        <div class="error-state">
            <h3>${message}</h3>
            <p>
                <a href="/blog" style="color: #007BFF; text-decoration: none;">
                    بازگشت به بلاگ
                </a>
            </p>
        </div>
    `;
}

// Toggle excerpt functionality
function toggleExcerpt() {
    const hiddenSpan = document.querySelector('.excerpt-hidden');
    const visibleSpan = document.querySelector('.excerpt-visible');
    const toggleBtn = document.querySelector('.excerpt-toggle');
    
    if (hiddenSpan && visibleSpan && toggleBtn) {
        const isHidden = hiddenSpan.style.display === 'none';
        
        if (isHidden) {
            // Show full excerpt
            hiddenSpan.style.display = 'inline';
            visibleSpan.innerHTML = visibleSpan.innerHTML.replace('...', '');
            toggleBtn.textContent = 'کمتر';
        } else {
            // Show truncated excerpt
            hiddenSpan.style.display = 'none';
            if (!visibleSpan.innerHTML.endsWith('...')) {
                visibleSpan.innerHTML += '...';
            }
            toggleBtn.textContent = 'ادامه';
        }
    }
}

// بارگیری مقاله هنگام بارگیری صفحه
document.addEventListener('DOMContentLoaded', loadPost);

// Mobile drawer functionality
const menuToggle = document.getElementById('menuToggle');
const mobileDrawer = document.getElementById('mobileDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerClose = document.getElementById('drawerClose');

function openDrawer() {
    mobileDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
    menuToggle.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    mobileDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
    menuToggle.classList.remove('active');
    document.body.style.overflow = '';
}

menuToggle.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// Close drawer when clicking on menu links
document.querySelectorAll('.drawer-menu .nav-link').forEach(link => {
    link.addEventListener('click', closeDrawer);
});

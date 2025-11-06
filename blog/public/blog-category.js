
let currentPage = 1;
let totalPages = 1;
let categorySlug = '';

// Safe truncation helper function
function safeTruncateText(text, maxLength = 500) {
    if (!text) return '';
    
    // Remove HTML tags first for accurate length calculation
    const textOnly = text.replace(/<[^>]*>/g, '');
    
    if (textOnly.length <= maxLength) {
        return text;
    }
    
    // Truncate the original text (with HTML) safely
    let truncated = text.substring(0, maxLength);
    
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

function toggleMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.getElementById('navMenu');
    
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
}

function getCategorySlugFromURL() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

//  اطلاعات دسته‌بندی
async function loadCategoryInfo() {
    try {
        categorySlug = getCategorySlugFromURL();
        
        const response = await fetch(`/api/blog/categories/${categorySlug}`);
        const data = await response.json();

        if (data.success && data.category) {
            const category = data.category;
            
            document.title = `${category.name} - بلاگ ZaTwo AI`;
            document.getElementById('categoryTitle').textContent = category.name;
            document.getElementById('categoryDescription').textContent = category.description || `مقالات مربوط به ${category.name}`;
            document.getElementById('breadcrumbCategory').textContent = category.name;
            
            loadPosts(1);
        } else {
            throw new Error('دسته‌بندی یافت نشد');
        }
    } catch (error) {
        console.error('خطا در بارگیری اطلاعات دسته‌بندی:', error);
        showError('دسته‌بندی یافت نشد');
    }
}

//  مقالات دسته‌بندی
async function loadPosts(page = 1) {
    try {
        const container = document.getElementById('postsContainer');
        container.innerHTML = `
            <div class="loading">
                <div class="loading-dots">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
                <p>در حال بارگیری مقالات...</p>
            </div>
        `;

        const response = await fetch(`/api/blog/posts/category/${categorySlug}?page=${page}&limit=9`);
        const data = await response.json();

        if (data.success) {
            displayPosts(data.posts || []);
            updatePagination(data.pagination);
            updateCategoryStats(data.pagination);
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error('خطا در بارگیری مقالات:', error);
        showError('خطا در بارگیری مقالات');
    }
}

function displayPosts(posts) {
    const container = document.getElementById('postsContainer');

    if (posts.length === 0) {
        showEmptyState();
        return;
    }

    const postsHtml = posts.map(post => createPostCard(post)).join('');
    container.innerHTML = `<div class="posts-grid">${postsHtml}</div>`;
}

function createPostCard(post) {
    const date = new Date(post.created_at * 1000).toLocaleDateString('fa-IR');

    const imageHtml = post.main_image 
        ? `<img src="/api/blog/images/${post.main_image}" alt="${post.title}" class="post-image">`
        : `<div class="post-image-placeholder"></div>`;

    // Use safeTruncateText for consistent excerpt handling
    const excerpt = post.excerpt ? safeTruncateText(post.excerpt, 300) : safeTruncateText(post.content, 300);

    return `
        <a href="/blog/${post.category_slug}/${post.slug}" class="post-card">
            ${imageHtml}
            <div class="post-content">
                <div class="post-meta">
                    <span class="post-category">${post.category_name}</span>
                    <span>${date}</span>
                </div>
                <h2 class="post-title">${post.title}</h2>
                <p class="post-excerpt">${excerpt}</p>
                <div class="read-more">ادامه مطلب</div>
            </div>
        </a>
    `;
}

function updatePagination(pagination) {
    const container = document.getElementById('paginationContainer');

    if (!pagination || pagination.pages <= 1) {
        container.innerHTML = '';
        return;
    }

    currentPage = pagination.page;
    totalPages = pagination.pages;

    let html = '<div class="pagination">';

    if (currentPage > 1) {
        html += `<a href="#" class="pagination-btn" onclick="changePage(${currentPage - 1})">قبلی</a>`;
    } else {
        html += `<span class="pagination-btn disabled">قبلی</span>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<span class="pagination-btn active">${i}</span>`;
        } else {
            html += `<a href="#" class="pagination-btn" onclick="changePage(${i})">${i}</a>`;
        }
    }

    if (currentPage < totalPages) {
        html += `<a href="#" class="pagination-btn" onclick="changePage(${currentPage + 1})">بعدی</a>`;
    } else {
        html += `<span class="pagination-btn disabled">بعدی</span>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

function updateCategoryStats(pagination) {
    const statsElement = document.getElementById('categoryStats');
    if (pagination && pagination.total) {
        statsElement.textContent = `${pagination.total} مقاله`;
    } else {
        statsElement.textContent = '';
    }
}

function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }

    loadPosts(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showEmptyState() {
    document.getElementById('postsContainer').innerHTML = `
        <div class="empty-state">
            <h3>مقاله‌ای یافت نشد</h3>
            <p>در حال حاضر مقاله‌ای در این دسته‌بندی وجود ندارد</p>
        </div>
    `;
}

function showError(message) {
    document.getElementById('postsContainer').innerHTML = `
        <div class="empty-state">
            <h3>خطا</h3>
            <p>${message}</p>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    loadCategoryInfo();
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.getElementById('navMenu');
    
    if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }
});

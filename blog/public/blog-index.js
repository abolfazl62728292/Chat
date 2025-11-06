
let currentPage = 1;
let totalPages = 1;
let currentCategory = "";

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
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.getElementById("navMenu");

    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
}

// بارگیری و نمایش دسته‌بندی‌ها
async function loadCategories() {
    try {
        const response = await fetch("/api/blog/categories");
        
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('احراز هویت لازم است');
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.success) {
            const categories = data.categories || [];
            displayCategories(categories);
        }
    } catch (error) {
        console.error("خطا در بارگیری دسته‌بندی‌ها:", error);
    }
}

function displayCategories(categories) {
    const container = document.getElementById("categoriesContainer");

    let html = '<a href="/blog" class="category-chip active" onclick="filterByCategory(\'\')">همه مقالات</a>';

    // Reverse the categories array to show them in reverse order
    categories.reverse().forEach((category) => {
        html += `<a href="/blog/category/${category.slug}" class="category-chip" onclick="filterByCategory('${category.slug}')">${category.name}</a>`;
    });

    container.innerHTML = html;
}

// بارگیری و نمایش مقالات
async function loadPosts(page = 1, categorySlug = "") {
    try {
        const container = document.getElementById("postsContainer");
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

        let url = `/api/blog/posts?page=${page}&limit=9`;
        if (categorySlug) {
            url = `/api/blog/posts/category/${categorySlug}?page=${page}&limit=9`;
        }

        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('احراز هویت لازم است');
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>دسترسی محدود</h3>
                        <p>لطفاً وارد شوید</p>
                    </div>
                `;
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.success) {
            displayPosts(data.posts || []);
            updatePagination(data.pagination);
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>مقاله‌ای یافت نشد</h3>
                    <p>در حال حاضر مقاله‌ای در این دسته‌بندی وجود ندارد</p>
                </div>
            `;
        }
    } catch (error) {
        console.error("خطا در بارگیری مقالات:", error);
        const container = document.getElementById("postsContainer");
        container.innerHTML = `
            <div class="empty-state">
                <h3>خطا در بارگیری</h3>
                <p>لطفاً صفحه را تازه‌سازی کنید</p>
            </div>
        `;
    }
}

function displayPosts(posts) {
    const container = document.getElementById("postsContainer");

    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>مقاله‌ای یافت نشد</h3>
                <p>هنوز مقاله‌ای منتشر نشده است</p>
            </div>
        `;
        return;
    }

    const postsHtml = posts.map((post) => createPostCard(post)).join("");
    container.innerHTML = `<div class="posts-grid">${postsHtml}</div>`;
}

function createPostCard(post) {
    const date = new Date(post.created_at * 1000).toLocaleDateString("fa-IR");

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
    const container = document.getElementById("paginationContainer");

    if (!pagination || pagination.pages <= 1) {
        container.innerHTML = "";
        return;
    }

    currentPage = pagination.page;
    totalPages = pagination.pages;

    let html = '<div class="pagination">';

    // دکمه قبلی
    if (currentPage > 1) {
        html += `<a href="#" class="pagination-btn" onclick="changePage(${currentPage - 1})">قبلی</a>`;
    } else {
        html += `<span class="pagination-btn disabled">قبلی</span>`;
    }

    // شماره صفحات
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<span class="pagination-btn active">${i}</span>`;
        } else {
            html += `<a href="#" class="pagination-btn" onclick="changePage(${i})">${i}</a>`;
        }
    }

    // دکمه بعدی
    if (currentPage < totalPages) {
        html += `<a href="#" class="pagination-btn" onclick="changePage(${currentPage + 1})">بعدی</a>`;
    } else {
        html += `<span class="pagination-btn disabled">بعدی</span>`;
    }

    html += "</div>";
    container.innerHTML = html;
}

function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }

    loadPosts(page, currentCategory);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function filterByCategory(categorySlug) {
    currentCategory = categorySlug;
    currentPage = 1;

    // بروزرسانی active class
    const chips = document.querySelectorAll(".category-chip");
    chips.forEach((chip) => {
        chip.classList.remove("active");
        if (chip.onclick && chip.onclick.toString().includes(categorySlug)) {
            chip.classList.add("active");
        }
    });

    loadPosts(1, categorySlug);
}

// بارگیری داده‌ها هنگام بارگیری صفحه
document.addEventListener("DOMContentLoaded", () => {
    loadCategories();
    loadPosts();
});

// Close menu when clicking outside
document.addEventListener("click", (e) => {
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.getElementById("navMenu");

    if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
        hamburger.classList.remove("active");
        navMenu.classList.remove("active");
    }
});

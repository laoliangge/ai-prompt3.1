// ==========================================
// 1. 云端连接
// ==========================================
const SUPABASE_URL = 'https://mcnilpwwzjtacotgzfcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LXmgVKowe5CIOr9v_PtODQ_dtC1fqkS';
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ==========================================
// 2. 全局变量
// ==========================================
let allData = []; 
let autoScrollTimer = null;
let isPaused = false; 

// ⚡ 核心：图片加载观察者
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            const id = img.dataset.id; 
            if (id) {
                loadImage(id, img); 
                observer.unobserve(img); 
            }
        }
    });
}, { rootMargin: "200px" });

// ==========================================
// 3. 启动逻辑
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (sb) {
        sb.from('prompts').select('id, title, category, prompt, sort_order')
          .order('sort_order', { ascending: false })
          .order('id', { ascending: false })
          .then(({ data, error }) => {
              if (error) { console.error('云端错误:', error); return; }
              allData = data || [];
              
              setupCategories(); 
              renderGallery('全部'); 
              setupSearch(); 
              
              startAutoScroll();   
              setupInteraction();  
              setupNavbarScroll(); 

              // 🔥 核心新增 1/2：读取记忆 (针对你的 App 架构)
              // 你的网页是 wrapper 在滚动，不是 window，所以要读 wrapper 的 scrollTop
              const savedPos = sessionStorage.getItem('gallery_scroll_pos');
              const scroller = document.getElementById('gallery-wrapper');
              if (savedPos && scroller) {
                  // 给一点点时间让图片占位，然后跳过去
                  setTimeout(() => {
                      scroller.scrollTop = parseFloat(savedPos);
                  }, 100);
              }
          });
    }
});

// ==========================================
// 4. 分类栏逻辑
// ==========================================
function setupCategories() {
    const pills = document.querySelectorAll('.cat-pill');
    pills.forEach(pill => {
        pill.onclick = function() {
            pills.forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            renderGallery(this.innerText.trim());
        };
    });
}

// ==========================================
// 5. 画廊渲染 (通用版)
// ==========================================
function renderGallery(filterType, searchKeyword = null) {
    const container = document.getElementById('columns-container');
    if (!container) return; 
    container.innerHTML = ''; 

    let filteredData = allData;
    
    if (searchKeyword) {
        const keywords = searchKeyword.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        
        if (keywords.length > 0) {
            filteredData = allData.filter(item => {
                const fullText = (item.title + item.category + (item.prompt || '')).toLowerCase();
                return keywords.every(k => fullText.includes(k));
            });
        } else {
             filteredData = []; 
        }

    } else if (filterType !== '全部') {
        filteredData = allData.filter(item => 
            item.category && item.category.includes(filterType)
        );
    }

    const colCount = window.innerWidth <= 768 ? 2 : 4;
    const columns = [];
    for (let i = 0; i < colCount; i++) {
        const col = document.createElement('div');
        col.className = 'gallery-column';
        container.appendChild(col);
        columns.push(col);
    }

    if (filteredData.length === 0) {
        container.innerHTML = '<div style="color:#666; width:100%; text-align:center; padding:50px;">未找到相关内容</div>';
        return;
    }

    filteredData.forEach((item, index) => {
        const colIndex = index % colCount;
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => openModal(item);
        
        const placeholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const imgStyle = "width:100%; height:auto; background:#1a1a1a;";

        if (window.innerWidth <= 768) {
            card.innerHTML = `
                <img src="${placeholder}" data-id="${item.id}" class="lazy-img" alt="${item.title}" style="${imgStyle}">
                <div class="card-info"><div class="card-title">${item.title}</div></div>`;
        } else {
            card.innerHTML = `
                <img src="${placeholder}" data-id="${item.id}" class="lazy-img" alt="${item.title}" style="${imgStyle}">
                <div class="card-info">
                    <span class="card-category">${item.category || ''}</span>
                    <div class="card-title">${item.title}</div>
                    <div class="card-desc">${item.prompt ? item.prompt.substring(0,50)+'...' : ''}</div>
                </div>`;
        }
        
        columns[colIndex].appendChild(card);
        const imgEl = card.querySelector('.lazy-img');
        imageObserver.observe(imgEl);
    });
}

async function loadImage(id, imgElement) {
    const { data, error } = await sb.from('prompts').select('imageUrl').eq('id', id).single();
    if (!error && data && data.imageUrl) {
        imgElement.src = data.imageUrl;
        imgElement.onload = () => { imgElement.style.background = 'transparent'; };
    }
}

// ==========================================
// 6. 搜索功能
// ==========================================
function setupSearch() {
    const btn = document.getElementById('openSearchBtn');
    const modal = document.getElementById('searchModal');
    const input = document.getElementById('globalSearchInput'); 
    const submitArrow = document.getElementById('searchSubmitBtn');
    
    if(!btn || !modal) return;

    const adjustInput = () => {
        input.style.height = 'auto'; 
        input.style.height = input.scrollHeight + 'px'; 
        
        const maxHeight = window.innerHeight * 0.4;
        
        if (input.scrollHeight > maxHeight) {
            input.style.overflowY = 'auto';
        } else {
            input.style.overflowY = 'hidden';
        }

        const visualLength = input.value.replace(/[^\x00-\xff]/g, "xx").length;
        if (visualLength > 16) {
            input.classList.add('long-text');
        } else {
            input.classList.remove('long-text');
        }
    };

    btn.onclick = () => {
        modal.style.display = 'flex';
        modal.classList.remove('smoke-exit'); 
        setTimeout(() => modal.classList.add('show'), 10);
        input.value = ""; 
        input.classList.remove('long-text'); 
        input.style.height = 'auto'; 
        input.style.overflowY = 'hidden'; 
        if(submitArrow) submitArrow.classList.remove('active'); 
        input.focus();
        isPaused = true; 
        history.pushState({modal: 'search'}, null, '#search');
    };

    if(input) {
        input.addEventListener('input', () => {
            adjustInput(); 
            if(input.value.trim().length > 0) {
                if(submitArrow) submitArrow.classList.add('active');
            } else {
                if(submitArrow) submitArrow.classList.remove('active');
            }
        });
    }

    const doSearch = () => {
        const val = input.value.trim();
        if(val) {
            renderGallery(null, val); 
            closeSearch(); 
            document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        }
    };
    
    if(submitArrow) {
        submitArrow.onclick = doSearch;
    }
}

window.closeSearch = function() {
    const modal = document.getElementById('searchModal');
    if (!modal || modal.style.display === 'none') return;
    
    modal.classList.add('smoke-exit'); 
    const input = document.getElementById('globalSearchInput');
    if(input) input.blur(); 
    
    setTimeout(() => { 
        modal.classList.remove('show');
        modal.classList.remove('smoke-exit'); 
        modal.style.display = 'none'; 
    }, 500);

    isPaused = false; 
    
    if(location.hash === '#search') {
        history.back();
    }
};

// ==========================================
// 7. 弹窗功能 (详情页)
// ==========================================
async function openModal(item) {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').innerText = item.title;
    document.getElementById('modalCategory').innerText = item.category || '未分类';
    document.getElementById('modalPrompt').innerText = item.prompt || '暂无提示词';
    document.getElementById('modalId').innerText = 'ID ' + item.id;
    
    const modalImg = document.getElementById('modalImage');
    modalImg.src = ""; 
    modalImg.style.opacity = '0.5'; 
    
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));
    isPaused = true;
    
    history.pushState({modal: 'detail'}, null, '#detail');

    const { data } = await sb.from('prompts').select('imageUrl').eq('id', item.id).single();
    if (data && data.imageUrl) {
        modalImg.src = data.imageUrl;
        modalImg.onload = () => { modalImg.style.opacity = '1'; };
    }
}

window.closeModal = function() {
    const modal = document.getElementById('modal');
    if (!modal || modal.style.display === 'none') return;

    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('modalImage').src = ''; 
    }, 300);
    isPaused = false;

    if(location.hash === '#detail') {
        history.back();
    }
}

// ==========================================
// 8. 全局监听 (物理返回键)
// ==========================================
window.addEventListener('popstate', (e) => {
    const searchModal = document.getElementById('searchModal');
    const detailModal = document.getElementById('modal');

    if (searchModal && searchModal.classList.contains('show')) {
        searchModal.classList.add('smoke-exit');
        setTimeout(() => {
            searchModal.classList.remove('show');
            searchModal.classList.remove('smoke-exit');
            searchModal.style.display = 'none';
        }, 500);
        isPaused = false;
    }
    
    if (detailModal && detailModal.classList.contains('show')) {
        detailModal.classList.remove('show');
        setTimeout(() => {
            detailModal.style.display = 'none';
            document.getElementById('modalImage').src = '';
        }, 300);
        isPaused = false;
    }
});

// ==========================================
// 9. 自动滚动 & 杂项
// ==========================================
function startAutoScroll() {
    const scroller = document.getElementById('gallery-wrapper'); 
    const speed = 0.5; 
    function step() {
        if (!isPaused && scroller) {
            if ((scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight - 1) {
            } else {
                scroller.scrollBy(0, speed);
            }
        }
        autoScrollTimer = requestAnimationFrame(step);
    }
    step();
}

function setupInteraction() {
    let pauseTimeout;
    const scroller = document.getElementById('gallery-wrapper');
    if (!scroller) return;
    window.addEventListener('mousemove', () => {
        isPaused = true;
        clearTimeout(pauseTimeout);
        pauseTimeout = setTimeout(() => { isPaused = false; }, 1000);
    });
    scroller.addEventListener('touchstart', () => {
        isPaused = true;
        clearTimeout(pauseTimeout);
    }, { passive: true });
    scroller.addEventListener('touchend', () => {
        pauseTimeout = setTimeout(() => { isPaused = false; }, 1000);
    });
}

function setupNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    const scroller = document.getElementById('gallery-wrapper');
    if (!navbar || !scroller) return;
    scroller.addEventListener('scroll', () => {
        if (scroller.scrollTop > 20) { navbar.classList.add('scrolled'); }
        else { navbar.classList.remove('scrolled'); }
        tryAutoPlay();
    });
}

function copyPrompt() {
    const text = document.getElementById('modalPrompt').innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.btn-copy');
        btn.innerText = "已复制";
        btn.classList.add('copied'); 
        setTimeout(() => { btn.innerText = "复制"; btn.classList.remove('copied'); }, 2000);
    });
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (allData.length === 0) return; 

        const activePill = document.querySelector('.cat-pill.active');
        if (activePill) {
            renderGallery(activePill.innerText);
        }
    }, 300);
});


// ==========================================
// 10. 音乐逻辑
// ==========================================
var bgm = document.getElementById('bgm');
var musicBtn = document.getElementById('musicBtn');
var isMusicPlayed = false; 
var isManuallyPaused = false; 

if (window.performance) {
    var navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0 && navEntries[0].type === 'reload') {
        sessionStorage.removeItem('music_status');
    } else if (performance.navigation.type === 1) {
        sessionStorage.removeItem('music_status');
    }
}

function toggleMusic() {
    if (!bgm) return;
    if (bgm.paused) {
        bgm.play().then(() => {
            musicBtn.classList.add('playing');
            isMusicPlayed = true;
            isManuallyPaused = false; 
            sessionStorage.setItem('music_status', 'playing');
        }).catch(e => console.log("播放失败"));
    } else {
        bgm.pause();
        musicBtn.classList.remove('playing');
        isManuallyPaused = true; 
        sessionStorage.setItem('music_status', 'paused');
    }
}

function tryAutoPlay() {
    if (!bgm) return;
    var savedStatus = sessionStorage.getItem('music_status');
    if (savedStatus === 'paused' || isManuallyPaused) return; 
    if (!bgm.paused) return;
    bgm.play().then(() => {
        musicBtn.classList.add('playing');
        isMusicPlayed = true;
        sessionStorage.setItem('music_status', 'playing');
    }).catch(e => {});
}

document.addEventListener('click', function(e) {
    var target = e.target.closest('a');
    if (target && target.getAttribute('href') === 'index.html') {
        if (window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html')) {
            e.preventDefault(); 
        }
    }
});

document.addEventListener('touchstart', tryAutoPlay, { passive: true });
document.addEventListener('click', tryAutoPlay);
window.addEventListener('pageshow', function(e) {
    if (!bgm) return;
    var savedStatus = sessionStorage.getItem('music_status');
    if (savedStatus === 'paused') {
        musicBtn.classList.remove('playing');
        isManuallyPaused = true;
    } else {
        isManuallyPaused = false;
        tryAutoPlay();
    }
});

// ==========================================
// 11. 滚动记忆系统 (针对 App 架构优化版)
// ==========================================
// 🔥 核心新增 2/2：离开时保存位置
window.addEventListener('beforeunload', () => {
    const scroller = document.getElementById('gallery-wrapper');
    // 如果能找到滚动容器，就保存它的位置
    if (scroller) {
        sessionStorage.setItem('gallery_scroll_pos', scroller.scrollTop);
    }
});

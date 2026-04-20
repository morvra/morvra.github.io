// newslist.js

document.addEventListener('DOMContentLoaded', function () {
    const newsListEl = document.getElementById('news-list');
    const filterInfoEl = document.getElementById('news-filter-info');

    // URLパラメータからタグ・検索クエリを取得
    const params = new URLSearchParams(window.location.search);
    const filterTag = params.get('tag') || '';
    const filterQuery = params.get('q') || '';

    fetch('./newslist.html')
        .then(r => {
            if (!r.ok) throw new Error(`Failed to load newslist.html: ${r.status}`);
            return r.text();
        })
        .then(html => {
            newsListEl.innerHTML = html;

            // innerHTML経由では<script>が実行されないため広告を手動初期化
            newsListEl.querySelectorAll('ins.adsbygoogle').forEach(ins => {
                try {
                    (adsbygoogle = window.adsbygoogle || []).push({});
                } catch (e) {
                    console.error('adsbygoogle push error:', e);
                }
            });
            // タグ絞り込みモード
            if (filterTag) {
                applyTagFilter(filterTag);
                filterInfoEl.innerHTML =
                    `<div class="news-filter-badge">タグ: <strong>#${filterTag}</strong> で絞り込み中 ` +
                    `<a href="./news">✕ 解除</a></div>`;
            }

            // 検索クエリがあればハイライト＆絞り込み
            if (filterQuery) {
                applySearchFilter(filterQuery);
                filterInfoEl.innerHTML =
                    `<div class="news-filter-badge">「<strong>${filterQuery}</strong>」で検索中 ` +
                    `<a href="./news">✕ 解除</a></div>`;
            }

            // タグ・検索絞り込み時は全月を展開する
            if (filterTag || filterQuery) {
                newsListEl.querySelectorAll('.news-sub-list').forEach(ul => {
                    ul.classList.remove('collapsed');
                });
                newsListEl.querySelectorAll('.month-header i').forEach(i => {
                    i.classList.remove('fa-chevron-right');
                    i.classList.add('fa-chevron-down');
                });
            }

            // 月ヘッダーの折りたたみトグル
            newsListEl.querySelectorAll('.month-header').forEach(header => {
                header.addEventListener('click', function () {
                    const subList = this.nextElementSibling;
                    const icon = this.querySelector('i');
                    const isCollapsed = subList.classList.contains('collapsed');
                    subList.classList.toggle('collapsed', !isCollapsed);
                    icon.classList.toggle('fa-chevron-right', !isCollapsed);
                    icon.classList.toggle('fa-chevron-down', isCollapsed);
                });
            });
        })
        .catch(err => console.error('Error loading newslist.html:', err));

    // ============================================================
    // タグ絞り込み: 指定タグを含まない .news-item を非表示
    // ============================================================
    function applyTagFilter(tag) {
        newsListEl.querySelectorAll('.news-item').forEach(item => {
            const tags = item.querySelectorAll('.news-tags a');
            const hasTag = Array.from(tags).some(a => a.textContent === `#${tag}`);
            if (!hasTag) item.style.display = 'none';
        });

        // 全アイテムが非表示になった日付グループも隠す
        newsListEl.querySelectorAll('.news-date-group').forEach(group => {
            const visible = group.querySelectorAll('.news-item:not([style*="display: none"])');
            if (visible.length === 0) group.style.display = 'none';
        });
    }

    // ============================================================
    // 検索絞り込み: タイトル・コメントにクエリが含まれるものだけ表示
    // ============================================================
    function applySearchFilter(query) {
        const q = query.toLowerCase();
        newsListEl.querySelectorAll('.news-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            if (!text.includes(q)) {
                item.style.display = 'none';
            } else {
                // マッチ部分をハイライト
                highlightText(item, query);
            }
        });

        newsListEl.querySelectorAll('.news-date-group').forEach(group => {
            const visible = group.querySelectorAll('.news-item:not([style*="display: none"])');
            if (visible.length === 0) group.style.display = 'none';
        });
    }

    function highlightText(element, query) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) nodes.push(node);

        const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        nodes.forEach(textNode => {
            if (!re.test(textNode.nodeValue)) return;
            const span = document.createElement('span');
            span.innerHTML = textNode.nodeValue.replace(re, '<mark class="highlight">$1</mark>');
            textNode.parentNode.replaceChild(span, textNode);
        });
    }
});
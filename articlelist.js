// articlelist.js

document.addEventListener('DOMContentLoaded', function() {
    const articleListElement = document.getElementById('article-list');

    // ビルド時に生成済みのHTMLフラグメントをそのまま流し込む
    fetch('./articlelist.html')
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load articlelist.html: ${response.status}`);
            return response.text();
        })
        .then(html => {
            articleListElement.innerHTML = html;

            // 年ヘッダーの折りたたみトグルだけ設定する
            articleListElement.querySelectorAll('.year-header').forEach(header => {
                header.addEventListener('click', function() {
                    const subList = this.nextElementSibling;
                    const icon    = this.querySelector('i');
                    const isCollapsed = subList.classList.contains('collapsed');

                    subList.classList.toggle('collapsed', !isCollapsed);
                    icon.classList.toggle('fa-chevron-right', !isCollapsed);
                    icon.classList.toggle('fa-chevron-down',   isCollapsed);
                });
            });
        })
        .catch(error => console.error('Error loading article list:', error));
});

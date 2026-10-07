// articles.js

document.addEventListener('DOMContentLoaded', function() {
    const articleListElement = document.getElementById('article-list');

    fetch('./articlelist.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `Failed to load articlelist.html: ${response.status}`
                );
            }

            return response.text();
        })
        .then(html => {
            articleListElement.innerHTML = html;

            // 記事一覧ページでは、すべての年度を常時表示する
            articleListElement
                .querySelectorAll('.article-sub-list')
                .forEach(list => {
                    list.classList.remove('collapsed');
                });

            // 年見出しの折りたたみ用アイコンを削除
            articleListElement
                .querySelectorAll('.year-header i')
                .forEach(icon => {
                    icon.remove();
                });

            // 折りたたみ用のクリックイベントは設定しない
        })
        .catch(error => {
            console.error('Error loading article list:', error);
        });
});
// news-latest.js
// news.jsonから最新日付のニュースをトップページに表示する

document.addEventListener('DOMContentLoaded', function () {
    fetch('./news-latest.json')
        .then(r => r.json())
        .then(data => {
            const items = data.news;
            if (!items || items.length === 0) return;

            // 最新日付を取得
            const latestDate = items[0].date; // 新しい順にソート済み

            // 同じ日付のアイテムだけ抽出
            const latestItems = items.filter(i => i.date === latestDate);

            const dateSlug = latestDate.replace(/-/g, '');
            const [year, mon, day] = latestDate.split('-');
            const dateLabel = `${year}年${parseInt(mon)}月${parseInt(day)}日`;

            let html = `<div id="news-latest-inner">
<div class="news-latest-header">
  <span class="news-latest-title">News</span>
  <a class="news-latest-date" href="/news/${dateSlug}.html">${dateLabel}</a>
  <a class="news-latest-more" href="/news">もっと見る &raquo;</a>
</div>
<ul class="news-items">`;

            latestItems.forEach(item => {
                const titleHtml = item.url
                    ? `<a href="${item.url}" target="_blank">${item.title}</a>`
                    : item.title;
                const tagsHtml = item.tags && item.tags.length > 0
                    ? `<span class="news-tags">${item.tags.map(t =>
                        `<a href="/news?tag=${t}">#${t}</a>`).join(' ')}</span>`
                    : '';
                html += `<li class="news-item">
<div class="news-item-header">${titleHtml}${tagsHtml ? ' ' + tagsHtml : ''}</div>
${item.comment || ''}
</li>`;
            });

            html += `</ul></div>`;
            document.getElementById('news-latest').innerHTML = html;
        })
        .catch(err => console.error('news-latest: failed to load news.json', err));
});
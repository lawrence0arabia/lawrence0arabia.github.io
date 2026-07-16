// Lights up the "Blog" nav link when a post was published in the last 3 days.
// Reads the Hugo-generated RSS feed rather than hardcoding anything, so it
// stays correct as new posts are published without touching this site again.
(function () {
	const RECENCY_DAYS = 3;
	const link = document.getElementById('nav-blog-link');
	if (!link) return;

	fetch('/blog/index.xml')
		.then(res => res.ok ? res.text() : Promise.reject(res.status))
		.then(xmlText => {
			const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
			const pubDateText = doc.querySelector('item pubDate')?.textContent;
			if (!pubDateText) return;

			const publishedAt = new Date(pubDateText);
			if (isNaN(publishedAt)) return;

			const ageInDays = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
			if (ageInDays >= 0 && ageInDays <= RECENCY_DAYS) {
				link.classList.add('has-recent-post');
			}
		})
		.catch(() => {
			// Blog unreachable or feed unavailable — fail silently, no glow.
		});
})();

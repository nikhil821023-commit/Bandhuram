function galleryCardHTML(img) {
  return `
    <div class="gallery-photo">
      <img src="${CONFIG.API_BASE_URL}${img.url}" alt="${escapeHtml(img.caption || 'Bandhuram')}" loading="lazy">
      ${img.caption ? `<span class="gallery-caption">${escapeHtml(img.caption)}</span>` : ''}
    </div>`;
}

async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  const section = document.getElementById('gallerySection');

  if (!grid || !section) {
    console.warn('Gallery elements not found in the DOM — check that #gallerySection and #galleryGrid exist in index.html');
    return;
  }

  try {
    const images = await API.getGallery();
    if (!images.length) {
      section.style.display = 'none';
      return;
    }
    grid.innerHTML = images.map(galleryCardHTML).join('');
    section.style.display = 'block';
  } catch (e) {
    section.style.display = 'none';
  }
}
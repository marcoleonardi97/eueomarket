let companies = [];
let segments = [];

const $ = (id) => document.getElementById(id);

const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

async function init() {
    [companies, segments] = await Promise.all([
        fetch('data/companies.json').then((r) => r.json()),
        fetch('data/segments.json').then((r) => r.json())
    ]);

    renderMarketMetrics();
    populateFilters();
    renderTable();
    renderValueChain();
    renderTechnologyMix();
    renderGeography();
    renderOpportunities();
    bindEvents();
}

function renderMarketMetrics() {
    $('metric-companies').textContent = companies.length;
}

function uniqueValues(key) {
    return [...new Set(companies.map((company) => company[key]).filter(Boolean))].sort();
}

function populateFilters() {
    const filters = [
        ['country', 'country', 'All countries'],
        ['layer', 'primary_layer', 'All value-chain layers'],
        ['tech', 'technology_domain', 'All technologies']
    ];

    filters.forEach(([id, key, label]) => {
        $(id).innerHTML = `<option value="">${label}</option>` +
            uniqueValues(key).map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
    });
}

function getFilteredCompanies() {
    const query = $('search').value.trim().toLowerCase();
    const country = $('country').value;
    const layer = $('layer').value;
    const tech = $('tech').value;

    return companies.filter((company) => {
        const haystack = JSON.stringify(company).toLowerCase();
        return (!query || haystack.includes(query))
            && (!country || company.country === country)
            && (!layer || company.primary_layer === layer)
            && (!tech || company.technology_domain === tech);
    });
}

function renderTable() {
    const filtered = getFilteredCompanies();
    $('count').textContent = `Showing ${filtered.length} of ${companies.length} companies`;

    $('table').innerHTML = filtered.map((company) => {
        const confidence = (company.confidence || '').toLowerCase();
        return `
            <tr data-company-id="${escapeHTML(company.company_id)}">
                <td>${escapeHTML(company.company)}</td>
                <td>${escapeHTML(company.country || '—')}</td>
                <td><span class="badge">${escapeHTML(company.value_chain_position || company.primary_layer || '—')}</span></td>
                <td>${escapeHTML(company.specific_capability || company.technology_domain || '—')}</td>
                <td>${escapeHTML(company.european_programme_role || '—')}</td>
                <td class="confidence-${confidence}">${escapeHTML(company.confidence || '—')}</td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('#table tr').forEach((row) => {
        row.addEventListener('click', () => openCompany(row.dataset.companyId));
    });
}

function renderValueChain() {
    const groups = {};
    companies.forEach((company) => {
        const key = company.value_chain_position || 'Unclassified';
        groups[key] = (groups[key] || 0) + 1;
    });

    const preferredOrder = ['EO data', 'EO infrastructure', 'EO analytics', 'EO applications', 'EO services'];
    const ordered = Object.entries(groups).sort((a, b) => {
        const ai = preferredOrder.indexOf(a[0]);
        const bi = preferredOrder.indexOf(b[0]);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return b[1] - a[1];
    });

    const max = Math.max(...ordered.map(([, count]) => count), 1);
    $('bars').innerHTML = ordered.map(([label, count], index) => `
        <article class="vc-item">
            <div class="vc-num">${String(count).padStart(2, '0')}</div>
            <div class="vc-label">${escapeHTML(label)}</div>
            <div class="vc-bar"><div class="vc-fill" style="width:${(count / max) * 100}%"></div></div>
            <div class="vc-note">${index + 1} · current universe</div>
        </article>
    `).join('');
}

function renderTechnologyMix() {
    const counts = {};
    companies.forEach((company) => {
        const key = company.technology_domain || 'Other / unspecified';
        counts[key] = (counts[key] || 0) + 1;
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = companies.length;
    const palette = ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#475569', '#0891b2', '#be123c'];
    let cursor = 0;
    const stops = entries.map(([label, count], i) => {
        const start = (cursor / total) * 100;
        cursor += count;
        const end = (cursor / total) * 100;
        return `${palette[i % palette.length]} ${start}% ${end}%`;
    });

    $('donut').style.background = `conic-gradient(${stops.join(', ')})`;
    $('donut-total').textContent = total;
    $('tech-legend').innerHTML = entries.slice(0, 7).map(([label, count], i) => `
        <div class="donut-key"><i style="background:${palette[i % palette.length]}"></i><span>${escapeHTML(label)}</span><b>${count}</b></div>
    `).join('');
}

function renderGeography() {
    const counts = {};
    companies.forEach((company) => {
        const key = company.country || 'Unspecified';
        counts[key] = (counts[key] || 0) + 1;
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = Math.max(...entries.map(([, count]) => count), 1);

    $('geo-bars').innerHTML = entries.map(([country, count]) => `
        <div class="geo-row">
            <span>${escapeHTML(country)}</span>
            <div class="geo-track"><div class="geo-fill" style="width:${(count / max) * 100}%"></div></div>
            <span class="geo-count">${count}</span>
        </div>
    `).join('');
}

function renderOpportunities() {
    $('segment-grid').innerHTML = segments.map((segment) => `
        <article class="opportunity">
            <div class="layer">${escapeHTML(segment.value_chain_layer || 'Market segment')}</div>
            <h3>${escapeHTML(segment.segment_name)}</h3>
            <p>${escapeHTML(segment.description)}</p>
            <div class="opportunity-footer">
                <span>Evidence status</span>
                <span class="pending">Scoring pending</span>
            </div>
        </article>
    `).join('');
}

function openCompany(companyId) {
    const company = companies.find((item) => item.company_id === companyId);
    if (!company) return;

    const fields = [
        ['Country', company.country],
        ['Value-chain position', company.value_chain_position],
        ['Primary layer', company.primary_layer],
        ['Technology', company.technology_domain],
        ['Capability', company.specific_capability],
        ['Business model', company.business_model],
        ['Target sector', company.target_sector],
        ['Customer type', company.customer_type],
        ['Founded', company.founded_year],
        ['Employees', company.employees],
        ['Revenue (€M)', company.revenue_eur_m],
        ['Funding (€M)', company.funding_total_eur_m],
        ['Copernicus CCM', company.copernicus_ccm ? 'Yes' : 'No'],
        ['CDSE presence', company.cdse_presence ? 'Yes' : 'No'],
        ['InCubed', company.incubed ? 'Yes' : 'No'],
        ['ESA BIC', company.esa_bic ? 'Yes' : 'No'],
        ['Confidence', company.confidence]
    ];

    $('drawer-content').innerHTML = `
        <div class="eyebrow dark">COMPANY PROFILE · ${escapeHTML(company.company_id)}</div>
        <h2 class="drawer-title">${escapeHTML(company.company)}</h2>
        <div class="drawer-sub">${escapeHTML(company.european_programme_role || company.primary_layer || '')}</div>
        <div class="detail-grid">
            ${fields.map(([label, value]) => `
                <div class="detail">
                    <span class="detail-label">${escapeHTML(label)}</span>
                    <span class="detail-value">${escapeHTML(value ?? '—')}</span>
                </div>
            `).join('')}
        </div>
        ${company.source_url ? `<a class="detail-source" href="${escapeHTML(company.source_url)}" target="_blank" rel="noopener">Open source ↗</a>` : ''}
    `;

    $('drawer').classList.add('open');
    $('drawer').setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
    $('drawer').classList.remove('open');
    $('drawer').setAttribute('aria-hidden', 'true');
}

function bindEvents() {
    $('search').addEventListener('input', renderTable);
    ['country', 'layer', 'tech'].forEach((id) => $(id).addEventListener('change', renderTable));
    $('reset').addEventListener('click', () => {
        $('search').value = '';
        $('country').value = '';
        $('layer').value = '';
        $('tech').value = '';
        renderTable();
    });
    $('drawer-close').addEventListener('click', closeDrawer);
    $('drawer-x').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeDrawer();
    });
}

init().catch((error) => {
    console.error(error);
    $('count').textContent = 'Could not load the research dataset.';
});

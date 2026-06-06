const SESSION_KEY = "batprefab_admin_logged";
const ADMIN_PASS = "Batprefab2026!"; 
const supabaseUrl = 'https://woohnwokwxlakvhtnyxa.supabase.co';
const supabaseKey = 'sb_publishable_GfY7g964Pi2i1PhhQktWqw_1qbY82cX'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);
const EMAILJS_PUBLIC_KEY = "8OueRxjN6hdWaV-y7"; 
const EMAILJS_SERVICE_ID = "service_5m0av3b"; 
const EMAILJS_TEMPLATE_ID = "Template ID";
const adminSound = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
let currentSelectedSession = null;

// ---------- AUTH ----------
function checkAdmin() {
    const input = document.getElementById('admin-pass');
    const errorMsg = document.getElementById('auth-error');
    const overlay = document.getElementById('auth-overlay');
    if (input.value === ADMIN_PASS) {
        sessionStorage.setItem(SESSION_KEY, "true");
        overlay.style.display = "none";
    } else {
        errorMsg.style.display = "block";
        input.value = "";
    }
}

function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.reload();
}

// ---------- RÉALISATIONS : AJOUT ----------
async function addRealisation() {
    const btn = document.querySelector('button[onclick="addRealisation()"]');
    const title = document.getElementById('real-title').value;
    const desc = document.getElementById('real-desc').value;
    const realDate = document.getElementById('real-date').value;
    const fileInput = document.getElementById('real-file');
    const files = fileInput.files;

    if (!title || files.length === 0) {
        alert("Merci de donner un titre et au moins une image/vidéo !");
        return;
    }

    btn.disabled = true;
    btn.innerText = "CHARGEMENT...";

    let uploadedUrls = [];
    let firstImageUrl = null;
    let firstVideoUrl = null;

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${i}.${fileExt}`;
            const filePath = `uploads/${fileName}`;
            const { error: uploadError } = await _supabase.storage.from('realisations').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: publicData } = _supabase.storage.from('realisations').getPublicUrl(filePath);
            const url = publicData.publicUrl;
            uploadedUrls.push(url);
            if (!firstVideoUrl && file.type.startsWith('video/')) {
                firstVideoUrl = url;
            } else if (!firstImageUrl && file.type.startsWith('image/')) {
                firstImageUrl = url;
            }
        }

        const { error: dbError } = await _supabase.from('realisations').insert([{
            title: title,
            description: desc,
            show_on_home: false,
            image_url: firstImageUrl,
            video_url: firstVideoUrl,
            gallery_urls: uploadedUrls,
            category: "Constructions",
            date_realisation: realDate || null
        }]);

        if (dbError) throw dbError;

        alert("Réalisation publiée !");
        location.reload();
    } catch (err) {
        alert("Erreur : " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "PUBLIER LE PROJET";
    }
}



// Suppression d'une réalisation (avec suppression des fichiers du bucket)
async function deleteRealisation(id) {
    console.log("deleteRealisation appelé pour l'id", id);
    if (!confirm("Supprimer définitivement ce projet et tous ses fichiers associés ?")) return;

    try {
        // 1. Récupérer les URLs des fichiers avant suppression
        const { data: projet, error: fetchError } = await _supabase
            .from('realisations')
            .select('gallery_urls, image_url, video_url')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Extraire tous les chemins relatifs des fichiers à supprimer
        const publicBase = _supabase.storage.from('realisations').getPublicUrl('').data.publicUrl;
        const allUrls = [];

        if (projet.image_url) allUrls.push(projet.image_url);
        if (projet.video_url) allUrls.push(projet.video_url);
        if (projet.gallery_urls && projet.gallery_urls.length) allUrls.push(...projet.gallery_urls);

        const pathsToDelete = allUrls.map(url => url.replace(publicBase, ''));

        // 3. Supprimer les fichiers du bucket (si des chemins existent)
        if (pathsToDelete.length) {
            const { error: storageError } = await _supabase.storage
                .from('realisations')
                .remove(pathsToDelete);
            if (storageError) console.warn("Erreur suppression fichiers:", storageError);
        }

        // 4. Supprimer l'entrée dans la base de données
        const { error: deleteError } = await _supabase
            .from('realisations')
            .delete()
            .eq('id', id);
        if (deleteError) throw deleteError;

        alert("Projet et fichiers supprimés !");
        loadAdminRealisations();
    } catch (err) {
        alert("Erreur : " + err.message);
    }
}

async function loadMessages() {
    const container = document.getElementById('messages-container');
    if (!container) return;

    const { data, error } = await _supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        container.innerHTML = "Erreur de chargement.";
        return;
    }

    if (data.length === 0) {
        container.innerHTML = "Aucune demande reçue.";
        return;
    }

    container.innerHTML = data.map(msg => `
        <div class="message-item" style="border-left-color: ${getStatusColor(msg.status)};">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div>
                    <strong>${escapeHtml(msg.nom)}</strong> — ${escapeHtml(msg.email)}<br>
                    <strong>Tél :</strong> ${escapeHtml(msg.telephone)}<br>
                    <strong>Catégorie :</strong> ${escapeHtml(msg.categorie || 'Non spécifiée')}
                </div>
                <div style="text-align: right;">
                    <select data-id="${msg.id}" class="status-select" style="background: #2c2c2c; border: 1px solid #444; padding: 5px 10px; border-radius: 20px;">
                        <option value="en_attente" ${msg.status === 'en_attente' ? 'selected' : ''}>En attente</option>
                        <option value="en_cours" ${msg.status === 'en_cours' ? 'selected' : ''}>En cours</option>
                        <option value="traite" ${msg.status === 'traite' ? 'selected' : ''}>Traité</option>
                    </select>
                    <button onclick="deleteContactMessage('${msg.id}')" style="background:#dc3545; color:white; border:none; border-radius: 20px; padding: 4px 12px; margin-left: 8px;">Supprimer</button>
                </div>
            </div>
            <div style="margin-top: 10px; padding: 10px; background: #111;">${escapeHtml(msg.message)}</div>
            <small>${new Date(msg.created_at).toLocaleString()}</small>
        </div>
    `).join('');

    // Attacher les événements après l'insertion dans le DOM
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const id = select.getAttribute('data-id');
            const newStatus = select.value;
            updateMessageStatus(id, newStatus);
        });
    });
}

// Couleur selon le statut
function getStatusColor(status) {
    switch (status) {
        case 'en_attente': return '#ffc107'; // jaune
        case 'en_cours': return '#17a2b8';   // cyan
        case 'traite': return '#28a745';     // vert
        default: return 'var(--blue)';
    }
}



// Suppression d'un message (déjà existante, on la garde)
async function deleteContactMessage(id) {
    if (!confirm("Supprimer définitivement cette demande ?")) return;
    const { error } = await _supabase.from('contacts').delete().eq('id', id);
    if (error) alert("Erreur suppression");
    else loadMessages();
}

// ---------- NEWSLETTER ----------
async function loadSubscribers() {
    const { data: subscribers, error } = await _supabase.from('newsletter').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error("Erreur abonnés:", error);
        return;
    }
    const countTarget = document.getElementById('count-target');
    if (countTarget) countTarget.innerText = subscribers ? subscribers.length : 0;
    const container = document.getElementById('subscribers-list');
    if (!container) return;
    if (!subscribers || subscribers.length === 0) {
        container.innerHTML = "<p style='padding:20px; color:#666;'>Aucun abonné.</p>";
        return;
    }
    container.innerHTML = subscribers.map(s => `
        <div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
            <span>${s.email}</span>
            <span style="font-size:0.7rem; color:#666;">${new Date(s.created_at).toLocaleDateString()}</span>
        </div>
    `).join('');
}

async function addSubscriberManual() {
    const emailInput = document.getElementById('manual-email');
    const email = emailInput.value.trim();
    if (!email) {
        alert("Entrez un email.");
        return;
    }
    try {
        const { error } = await _supabase.from('newsletter').insert([{ email: email }]);
        if (error) throw error;
        alert("Abonné ajouté !");
        emailInput.value = "";
        loadSubscribers(); 
    } catch (err) {
        alert("Erreur : " + err.message);
    }
}

function generateEmailHTML(heading, body, link) {
    const logoUrl = "https://files.fm/u/3xezc8eks2"; 
    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Oswald:wght@500;700&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Montserrat',Arial,sans-serif;color:#333;">
<table width="100%" bgcolor="#f4f4f4" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #ddd;max-width:600px;margin:0 auto;">
<tr><td align="center" style="padding:25px;border-top:5px solid #000;background:#FFC107;"><img src="${logoUrl}" alt="BAT & PREFAB" style="max-height:50px;"></td></tr>
<tr><td style="padding:40px 30px;"><h2 style="font-family:'Oswald',Arial,sans-serif;color:#000;font-size:26px;text-transform:uppercase;margin:0 0 20px;border-left:4px solid #FFC107;padding-left:15px;">${heading}</h2>
<p style="font-size:16px;line-height:1.7;color:#444;margin:0;">${body.replace(/\n/g,'<br>')}</p>
${link ? `<div style="margin-top:35px;"><a href="${link}" style="display:inline-block;background:#000;color:#FFC107;padding:14px 30px;text-decoration:none;font-weight:bold;font-family:'Oswald',sans-serif;text-transform:uppercase;">VOIR LES DÉTAILS →</a></div>` : ''}</td></tr>
<tr><td style="background:#f9f9f9;padding:40px 30px;border-top:1px solid #eee;"><table width="100%"><tr><td width="55%"><h4 style="font-family:'Oswald',sans-serif;color:#000;margin:0 0 10px;">DÉMARRONS VOTRE PROJET</h4><p style="font-size:13px;color:#666;">L'expertise de l'acier et du béton.</p></td>
<td width="45%"><h4 style="font-family:'Oswald',sans-serif;color:#000;margin:0 0 10px;">NOUS CONTACTER</h4><div style="font-size:12px;line-height:1.8;"><a href="mailto:contact@batprefab.com" style="color:#333;">contact@batprefab.com</a><br>
<a href="tel:+2250556121339" style="color:#333;">+225 05 56 12 13 39</a> <span style="color:#25D366;">(WA)</span><br>
<a href="tel:+2250789855251" style="color:#333;">+225 07 89 85 52 51</a><br>
<a href="tel:+2252721399717" style="color:#333;">+225 27 21 39 97 17</a></div></td></tr></table>
<div style="margin-top:30px;text-align:center;"><a href="https://www.goafricaonline.com/ci/581881-batprefab-construction-abidjan-cote-ivoire" style="color:#FFC107;margin:0 10px;font-size:12px;">GO AFRICA ONLINE</a>
<a href="https://www.linkedin.com/company/bat-prefab" style="color:#000;margin:0 10px;font-weight:bold;font-size:11px;">LINKEDIN</a>
<a href="https://www.facebook.com/Batprefab.ci" style="color:#000;margin:0 10px;font-weight:bold;font-size:11px;">FACEBOOK</a></div>
<div style="margin-top:30px;text-align:center;border-top:1px solid #ddd;padding-top:20px;"><p style="font-size:10px;color:#999;">© 2026 BAT & PREFAB. Tous droits réservés.<br>Koumassi, bd du Gabon, Abidjan, CI.</p></div></td></tr>
</table></td></tr></table>
</body></html>`;
}

function previewEmail() {
    const heading = document.getElementById('mail-heading')?.value || "Sans titre";
    const body = document.getElementById('mail-body')?.value || "Aucun message";
    const link = document.getElementById('mail-link')?.value || "";
    let box = document.getElementById('preview-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'preview-box';
        box.style.cssText = 'border:1px solid #FFD700;background:#fff;color:#000;padding:20px;margin-top:20px;border-radius:12px;';
        document.querySelector('#view-send').appendChild(box);
    }
    box.innerHTML = generateEmailHTML(heading, body, link);
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function sendCampaign() {
    if(!confirm("Envoyer à tous les abonnés ?")) return;
    const subject = document.getElementById('mail-subject').value;
    const heading = document.getElementById('mail-heading').value;
    const body = document.getElementById('mail-body').value;
    const link = document.getElementById('mail-link').value;
    const { data: subscribers, error: dbError } = await _supabase.from('newsletter').select('email');
    if (dbError || !subscribers || subscribers.length === 0) {
        alert("Erreur ou aucun abonné.");
        return;
    }
    const htmlContent = generateEmailHTML(heading, body, link);
    for (let sub of subscribers) {
        try {
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { 
                to_email: sub.email, 
                subject: subject, 
                html_content: htmlContent 
            });
            document.getElementById('sending-log').innerText = `Envoyé à : ${sub.email}`;
        } catch (err) { 
            console.error(err);
            alert("Erreur d'envoi à " + sub.email);
            break;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    alert("Campagne terminée !");
}


async function loadChatSessions() {
    const { data: messagesData, error: msgsError } = await _supabase
        .from('messages')
        .select('session_id, client_name')
        .order('created_at', { ascending: false });

    if (msgsError || !messagesData) return;

    // Construire une map session_id -> nom (en prenant le premier client_name non nul trouvé)
    const nameMap = new Map();
    for (let msg of messagesData) {
        if (msg.client_name && !nameMap.has(msg.session_id)) {
            nameMap.set(msg.session_id, msg.client_name);
        }
    }

    const uniqueSessions = [...new Set(messagesData.map(m => m.session_id))];
    const container = document.getElementById('sessions-container');
    if (!container) return;

    if (uniqueSessions.length === 0) {
        container.innerHTML = "<div style='padding:15px;'>Aucune conversation</div>";
        return;
    }

    container.innerHTML = uniqueSessions.map(id => {
        const displayName = nameMap.get(id) || `Client #${id.substring(0,5)}`;
        return `<div class="session-item" style="padding:15px;border-bottom:1px solid #222;cursor:pointer;" onclick="selectSession('${id}')">${escapeHtml(displayName)}</div>`;
    }).join('');
}

async function selectSession(sessionId) {
    currentSelectedSession = sessionId;

    // Récupérer le nom du client depuis le premier message de la session
    const { data: firstMsg } = await _supabase
        .from('messages')
        .select('client_name')
        .eq('session_id', sessionId)
        .not('client_name', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    const clientName = firstMsg?.client_name || sessionId.substring(0,8);
    document.getElementById('active-session-id').innerHTML = `💬 CHAT AVEC : <strong>${escapeHtml(clientName)}</strong>`;

    const { data: messages } = await _supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    const box = document.getElementById('admin-messages-box');
    if (box) {
        if (!messages || messages.length === 0) {
            box.innerHTML = "<div style='padding:20px; text-align:center;'>Aucun message pour cette conversation.</div>";
            return;
        }
        box.innerHTML = messages.map(m => {
            const isAdmin = m.sender_role === 'admin';
            const senderName = isAdmin ? 'Vous' : clientName;
            // Masquer les messages système "CLIENT_NAME:..."
            if (m.content && m.content.startsWith('CLIENT_NAME:')) return '';
            return `
                <div style="display: flex; justify-content: ${isAdmin ? 'flex-end' : 'flex-start'}; margin-bottom: 10px;">
                    <div style="max-width: 70%; background: ${isAdmin ? 'var(--blue)' : '#2c2c2c'}; color: ${isAdmin ? '#fff' : '#eee'}; padding: 10px; border-radius: 15px;">
                        <strong style="font-size:0.7rem;">${escapeHtml(senderName)}</strong><br>
                        ${escapeHtml(m.content)}
                        <div style="font-size:0.6rem; opacity:0.5; margin-top:4px;">${new Date(m.created_at).toLocaleTimeString()}</div>
                    </div>
                </div>
            `;
        }).join('');
        box.scrollTop = box.scrollHeight;
    }
}


async function sendAdminReply() {
    const input = document.getElementById('admin-reply-input');
    if (!input.value.trim() || !currentSelectedSession) return;
    await _supabase.from('messages').insert([{ content: input.value, sender_role: 'admin', session_id: currentSelectedSession }]);
    input.value = '';
    selectSession(currentSelectedSession); 
}

// ---------- PROMOTIONS ----------
async function publishPromo() {
    const title = document.getElementById('promo-title').value;
    const message = document.getElementById('promo-message').value;
    const imgFile = document.getElementById('promo-img').files[0];
    if(!title || !message) return;
    try {
        let imageUrl = null;
        if (imgFile) {
            const imgName = `promo_${Date.now()}`;
            await _supabase.storage.from('realisations').upload(imgName, imgFile);
            imageUrl = _supabase.storage.from('realisations').getPublicUrl(imgName).data.publicUrl;
        }
        await _supabase.from('promotions').insert([{ title, message, image_url: imageUrl, is_active: true }]);
        alert("Promotion publiée !");
        loadActivePromosList();
    } catch (err) { alert(err.message); }
}

async function disablePromo() {
    if (!confirm("Désactiver toutes les promotions actives ?")) return;
    const { error } = await _supabase.from('promotions').update({ is_active: false }).eq('is_active', true);
    if (error) alert("Erreur : " + error.message);
    else {
        alert("Toutes les promotions ont été désactivées.");
        loadActivePromosList();
    }
}

async function loadActivePromosList() {
    const container = document.getElementById('active-promos-list');
    if(!container) return;
    const { data } = await _supabase.from('promotions').select('*').eq('is_active', true).order('created_at', { ascending: false });
    container.innerHTML = (data || []).map(p => `<div style="background:#222;padding:15px;margin-bottom:10px;display:flex;justify-content:space-between;"><span>${p.title}</span><button onclick="deletePromo(${p.id})" style="background:red;color:white;border:none;cursor:pointer;">X</button></div>`).join('');
}

async function deletePromo(id) {
    if(!confirm("Retirer ?")) return;
    await _supabase.from('promotions').update({ is_active: false }).eq('id', id);
    loadActivePromosList();
}

// ---------- MODAL D'ÉDITION (corrigé) ----------
function openEditModal(id) {
    console.log("openEditModal appelé avec id =", id);
    const modal = document.getElementById('editModal');
    if (!modal) {
        console.error("Modal #editModal introuvable !");
        return;
    }
    modal.style.display = 'flex';
    document.getElementById('edit-id').value = id;
    loadRealisationData(id);
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
}

async function loadRealisationData(id) {
    try {
        console.log("Chargement des données pour l'id", id);
        const { data, error } = await _supabase.from('realisations').select('*').eq('id', id).single();
        if (error) throw error;
        if (!data) throw new Error("Aucune donnée");

        document.getElementById('edit-title').value = data.title || '';
        document.getElementById('edit-description').value = data.description || '';
        document.getElementById('edit-date').value = data.date_realisation || '';

        const gallery = data.gallery_urls || [];
        const container = document.getElementById('existing-images-container');
        if (gallery.length === 0) {
            container.innerHTML = '<div class="status-text">Aucune image actuellement.</div>';
        } else {
            container.innerHTML = gallery.map((url, idx) => `
                <div style="position:relative;display:inline-block;">
                    <img src="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:12px;border:1px solid #444;">
                    <button onclick="removeImageFromGallery('${id}', '${url.replace(/'/g, "\\'")}', ${idx})" 
                        style="position:absolute;top:-8px;right:-8px;background:#dc3545;color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px;">✕</button>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Erreur loadRealisationData :", err);
        alert("Impossible de charger les données : " + err.message);
    }
}

async function removeImageFromGallery(realisationId, imageUrl, index) {
    if (!confirm("Supprimer cette image ?")) return;
    const publicBase = _supabase.storage.from('realisations').getPublicUrl('').data.publicUrl;
    const relativePath = imageUrl.replace(publicBase, '');
    await _supabase.storage.from('realisations').remove([relativePath]).catch(e => console.warn(e));
    const { data: real, error } = await _supabase.from('realisations').select('gallery_urls, image_url').eq('id', realisationId).single();
    if (error) return alert("Erreur base : " + error.message);
    let gallery = real.gallery_urls || [];
    gallery = gallery.filter(url => url !== imageUrl);
    let newImageUrl = real.image_url;
    if (real.image_url === imageUrl && gallery.length > 0) newImageUrl = gallery[0];
    else if (real.image_url === imageUrl && gallery.length === 0) newImageUrl = null;
    const { error: updateError } = await _supabase.from('realisations').update({ gallery_urls: gallery, image_url: newImageUrl }).eq('id', realisationId);
    if (updateError) alert("Erreur mise à jour : " + updateError.message);
    else {
        loadRealisationData(realisationId);
        loadAdminRealisations();
    }
}

async function addImagesToGallery(realisationId, files) {
    if (!files.length) return [];
    const newUrls = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `uploads/${Date.now()}_${Math.random()}_${i}.${fileExt}`;
        const { error: uploadError } = await _supabase.storage.from('realisations').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: publicData } = _supabase.storage.from('realisations').getPublicUrl(fileName);
        newUrls.push(publicData.publicUrl);
    }
    return newUrls;
}

async function updateRealisation() {
    const id = document.getElementById('edit-id').value;
    const newTitle = document.getElementById('edit-title').value;
    const newDesc = document.getElementById('edit-description').value;
    const newDate = document.getElementById('edit-date').value;
    const newFiles = document.getElementById('edit-new-images').files;
    const newVideoFile = document.getElementById('edit-new-video')?.files[0];
    if (!newTitle) return alert("Le titre est obligatoire.");
    const { data: current, error: fetchError } = await _supabase.from('realisations').select('gallery_urls, image_url, video_url').eq('id', id).single();
    if (fetchError) return alert("Erreur chargement : " + fetchError.message);
    let gallery = current.gallery_urls || [];
    let firstImage = current.image_url;
    let firstVideo = current.video_url;
    if (newFiles.length > 0) {
        const newUrls = await addImagesToGallery(id, newFiles);
        gallery.push(...newUrls);
        if (!firstImage && newUrls.length) firstImage = newUrls[0];
    }
    if (newVideoFile) {
        const fileExt = newVideoFile.name.split('.').pop();
        const fileName = `uploads/video_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await _supabase.storage.from('realisations').upload(fileName, newVideoFile);
        if (!uploadError) {
            const { data: publicData } = _supabase.storage.from('realisations').getPublicUrl(fileName);
            firstVideo = publicData.publicUrl;
        } else alert("Erreur upload vidéo");
    }
    if (gallery.length > 0 && !firstImage) firstImage = gallery[0];
    else if (gallery.length === 0) firstImage = null;
    const updatePayload = { title: newTitle, description: newDesc, date_realisation: newDate || null, gallery_urls: gallery, image_url: firstImage, video_url: firstVideo };
    const { error: updateError } = await _supabase.from('realisations').update(updatePayload).eq('id', id);
    if (updateError) alert("Erreur mise à jour : " + updateError.message);
    else {
        alert("Modifications enregistrées !");
        closeEditModal();
        loadAdminRealisations();
        document.getElementById('edit-new-images').value = '';
        if(document.getElementById('edit-new-video')) document.getElementById('edit-new-video').value = '';
    }
}

async function loadAdminRealisations() {
    const container = document.getElementById('admin-realisations-list');
    if (!container) return;
    container.innerHTML = "<p>Chargement...</p>";
    try {
        const { data, error } = await _supabase.from('realisations').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) {
            container.innerHTML = "<p>Aucun projet trouvé.</p>";
            return;
        }
        let html = `<table style="width:100%; border-collapse: collapse; margin-top:20px; color:white; font-size:0.85rem;">
            <thead><tr style="border-bottom: 2px solid var(--yellow); text-align:left;">
                <th style="padding:8px;">Média</th>
                <th style="padding:8px;">Titre</th>
                <th style="padding:8px;">Actions</th>
            </tr></thead><tbody>`;
        data.forEach(proj => {
            const thumb = proj.image_url || (proj.gallery_urls && proj.gallery_urls[0]) || 'https://via.placeholder.com/50';
            html += `<tr style="border-bottom: 1px solid #333;">
                <td style="padding:8px;"><img src="${thumb}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;" onerror="this.src='https://via.placeholder.com/50'"></td>
                <td style="padding:8px;">${escapeHtml(proj.title)}</td>
                <td style="padding:8px;">
                    <button data-id="${proj.id}" data-action="edit" style="background:#FFD700;color:#000;border:none;padding:6px 12px;border-radius:6px;margin-right:8px;cursor:pointer;">Modifier</button>
                    <button data-id="${proj.id}" data-action="delete" style="background:#dc3545;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;">Supprimer</button>
                </td>
            </tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
        console.log("Liste des projets affichée (sans colonne Accueil)");
    } catch (err) {
        console.error("Erreur loadAdminRealisations :", err);
        container.innerHTML = "<p style='color:red;'>Erreur : " + err.message + "</p>";
    }
}

// Gestion centralisée des clics sur les boutons dynamiques
document.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if (!id) return;

    if (action === 'edit') {
        e.preventDefault();
        console.log("Clic sur Modifier, id =", id);
        openEditModal(id);  // ← ne plus utiliser parseInt
    } else if (action === 'delete') {
        e.preventDefault();
        console.log("Clic sur Supprimer, id =", id);
        deleteRealisation(id);
    } else if (action === 'home') {
        e.preventDefault();
        const currentStatus = btn.textContent.trim() === '✅';
        updateHomeStatus(id, currentStatus);
    }
});

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ---------- INITIALISATION ----------
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM chargé, initialisation...");
    emailjs.init(EMAILJS_PUBLIC_KEY);
    const isLogged = sessionStorage.getItem(SESSION_KEY);
    if (isLogged === "true") {
        const overlay = document.getElementById('auth-overlay');
        if(overlay) overlay.style.display = "none";
    }
    const inputPass = document.getElementById('admin-pass');
    if(inputPass) inputPass.addEventListener("keypress", (e) => { if (e.key === "Enter") checkAdmin(); });
    const adminInput = document.getElementById('admin-reply-input');
    if (adminInput) adminInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendAdminReply(); });
    
    loadAdminRealisations();
    loadMessages();
    loadSubscribers();
    loadChatSessions();
    loadActivePromosList();
});



// Variables globales
let currentFilter = 'all';

// Chargement des messages avec filtre
async function loadMessages() {
    const container = document.getElementById('messages-container');
    if (!container) return;

    let query = _supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

    if (currentFilter !== 'all') {
        query = query.eq('status', currentFilter);
    }

    const { data, error } = await query;
    if (error) {
        console.error(error);
        container.innerHTML = "Erreur de chargement.";
        return;
    }

    if (!data.length) {
        container.innerHTML = "Aucune demande reçue.";
        return;
    }

    // Génération du HTML
    container.innerHTML = data.map(msg => `
        <div class="message-item" style="border-left-color: ${getStatusColor(msg.status)};">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div>
                    <strong>${escapeHtml(msg.nom)}</strong> — ${escapeHtml(msg.email)}<br>
                    <strong>Tél :</strong> ${escapeHtml(msg.telephone)}<br>
                    <strong>Catégorie :</strong> ${escapeHtml(msg.categorie || 'Non spécifiée')}
                </div>
                <div style="text-align: right;">
                    <select data-id="${msg.id}" class="status-select" style="background: #2c2c2c; border: 1px solid #444; padding: 5px 10px; border-radius: 20px;">
                        <option value="en_attente" ${msg.status === 'en_attente' ? 'selected' : ''}>En attente</option>
                        <option value="en_cours" ${msg.status === 'en_cours' ? 'selected' : ''}>En cours</option>
                        <option value="traite" ${msg.status === 'traite' ? 'selected' : ''}>Traité</option>
                    </select>
                    <button onclick="deleteContactMessage('${msg.id}')" style="background:#dc3545; color:white; border:none; border-radius: 20px; padding: 4px 12px; margin-left: 8px;">Supprimer</button>
                </div>
            </div>
            <div style="margin-top: 10px; padding: 10px; background: #111;">${escapeHtml(msg.message)}</div>
            <small>${new Date(msg.created_at).toLocaleString()}</small>
        </div>
    `).join('');

    // Attacher les événements de changement de statut
    document.querySelectorAll('.status-select').forEach(select => {
        select.removeEventListener('change', handleStatusChange);
        select.addEventListener('change', handleStatusChange);
    });
}

// Gestionnaire pour le changement de statut
function handleStatusChange(e) {
    const select = e.target;
    const id = select.getAttribute('data-id');
    const newStatus = select.value;
    updateMessageStatus(id, newStatus);
}

// Mise à jour du statut dans Supabase
async function updateMessageStatus(id, newStatus) {
    const { error } = await _supabase
        .from('contacts')
        .update({ status: newStatus })
        .eq('id', id);
    if (error) {
        console.error(error);
        alert("Erreur lors de la mise à jour du statut.");
    } else {
        await loadMessages(); // Recharge la liste
    }
}

// Suppression d'un message
async function deleteContactMessage(id) {
    if (!confirm("Supprimer définitivement cette demande ?")) return;
    const { error } = await _supabase.from('contacts').delete().eq('id', id);
    if (error) alert("Erreur suppression");
    else await loadMessages();
}

// Couleur selon le statut
function getStatusColor(status) {
    switch (status) {
        case 'en_attente': return '#ffc107';
        case 'en_cours': return '#17a2b8';
        case 'traite': return '#28a745';
        default: return 'var(--blue)';
    }
}

// Fonction appelée par les boutons de filtre
async function filterMessages(status) {
    currentFilter = status;
    await loadMessages();
}

// REALTIME CHAT
_supabase.channel('admin-realtime').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
    if (payload.new.sender_role === 'user') {
        adminSound.play(); 
        document.title = "NOUVEAU MESSAGE !";
        setTimeout(() => { document.title = "Admin - BAT & PREFAB"; }, 3000);
    }
    loadChatSessions(); 
    if (payload.new.session_id === currentSelectedSession) selectSession(currentSelectedSession);
}).subscribe();
const { 
    makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    delay,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const ytSearch = require('yt-search');
const ytdl = require('ytdl-core-muxer');

// 👑 बोट की कस्टमाइज़ेशन सेटिंग्स
const BOT_NAME = "ॐ❍𝐁𝐈𝐓❍°❤️𝆺꯭𝅥⎯‌꯭"; 
const OWNER_NAME = "P ｒｉｍｅ－Ｘᝰ..ᐟ.ᐟ";
// ⚠️ यहाँ अपना असली व्हाट्सएप नंबर कंट्री कोड '91' के साथ डालें (जैसे: "919800378187@s.whatsapp.net")
const OWNER_NUMBER = "919800378187@s.whatsapp.net"; 

const MENU_IMAGE_URL = "https://kommodo.ai/i/jk9yFOZNL7CrnoZYKVKr"; 
const CHANNEL_LINK = "https://whatsapp.com/channel/0029Vb7kF10HgZWjQhQape0M"; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('darko_session');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: false // क्यूआर कोड बंद है, यह पेयरिंग कोड से चलेगा
    });

    sock.ev.on('creds.update', saveCreds);

    // कनेक्शन मैनेजमेंट
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log(`🟢 ${BOT_NAME} बोट अब पूरी तरह से एक्टिव और लाइव है!`);
        }
    });

    // ग्रुप इवेंट्स - स्ट्रिक्ट एडमिन लॉक और वेलकम/गुडबाय
    sock.ev.on('group-participants.update', async (anu) => {
        try {
            const metadata = await sock.groupMetadata(anu.id);
            const num = anu.participants[0]; 
            const userTag = `@${num.split('@')[0]}`;
            const author = anu.author; 

            // 🔒 स्ट्रिक्ट एडमिन लॉक (सिर्फ ओनर ही एडमिन बना सकता है)
            if (anu.action === 'promote') {
                const isOwnerAction = author && author.includes(OWNER_NUMBER.split('@')[0]);
                if (!isOwnerAction && author) {
                    const authorTag = `@${author.split('@')[0]}`;
                    let warningText = `🚨 *सिक्योरिटी अलर्ट: अवैध एडमिन प्रमोशन!* 🚨\n\n` +
                                      `👤 एडमिन बनाने की कोशिश की: ${authorTag}\n` +
                                      `👥 जिसे एडमिन बनाया जा रहा था: ${userTag}\n\n` +
                                      `❌ *${BOT_NAME} स्ट्रिक्ट मोड:* ओनर के अलावा कोई एडमिन नहीं बना सकता। दोनों को डिमोट किया जा रहा है!`;
                    
                    await sock.sendMessage(anu.id, { text: warningText, mentions: [author, num] });
                    await sock.groupParticipantsUpdate(anu.id, [num], "demote");
                    await delay(1000); 
                    await sock.groupParticipantsUpdate(anu.id, [author], "demote");
                    return;
                }
                if (isOwnerAction) {
                    await sock.sendMessage(anu.id, { text: `✨ *बधाई हो!* ✨\n\n👑 ${userTag} अब इस ग्रुप के नए एडमिन हैं।`, mentions: [num] });
                }
            }
            
            // 👋 Welcome (फोटो के साथ)
            if (anu.action === 'add') {
                let welcomeText = `✨ *स्वागत है आपका!* ✨\n\n📝 *ग्रुप:* ${metadata.subject}\n👤 *सदस्य:* ${userTag}\n\nउम्मीद है आपको यहाँ अच्छा लगेगा!\n\n⚡ Powered by *${BOT_NAME}*`;
                await sock.sendMessage(anu.id, { image: { url: MENU_IMAGE_URL }, caption: welcomeText, mentions: [num] });
            }
            
            // 🏃 GoodBye (फोटो के साथ)
            if (anu.action === 'remove') {
                let goodbyeText = `🍂 *अलविदा!* 🍂\n\n👤 ${userTag} ग्रुप छोड़कर चले गए।\n\nहम आपके अच्छे भविष्य की कामना करते हैं!`;
                await sock.sendMessage(anu.id, { image: { url: MENU_IMAGE_URL }, caption: goodbyeText, mentions: [num] });
            }
        } catch (err) {
            console.log("इवेंट एरर: ", err);
        }
    });

    // मैसेज और कमांड्स मैनेजमेंट
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            
            const type = Object.keys(mek.message)[0];
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            
            const pushName = mek.pushName || 'WhatsApp User';
            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = sender.includes(OWNER_NUMBER.split('@')[0]);

            const body = (type === 'conversation') ? mek.message.conversation : 
                         (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : '';
            
            // 🚫 ANTI-LINK (लिंक डिलीट करना)
            if (isGroup && body.match(/(https:\/\/|http:\/\/|www\.|chat.whatsapp.com)/gi)) {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants;
                const isBotAdmin = participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
                const isSenderAdmin = participants.find(p => p.id === sender)?.admin;

                if (!isSenderAdmin && !isOwner && isBotAdmin) {
                    await sock.sendMessage(from, { delete: mek.key });
                    await sock.sendMessage(from, { text: `⚠️ *@${sender.split('@')[0]}*, ग्रुप में लिंक भेजना मना है! आपका मैसेज डिलीट कर दिया गया है।`, mentions: [sender] });
                }
            }

            if (!body.startsWith('!')) return; 
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);

            // 🔑 १. ग्रुप से सीधे बोट लिंक करने की कमांड (!join)
            if (command === 'join') {
                const targetNumber = args[0];
                if (!targetNumber || isNaN(targetNumber)) {
                    return sock.sendMessage(from, { text: `❌ *गलत फॉर्मेट!* \n\nसही तरीका: ` + '`!join 919800378187`' + ` (कंट्री कोड के साथ नंबर लिखें)` });
                }

                await sock.sendMessage(from, { text: `⏳ *${BOT_NAME} सिस्टम:* नंबर (${targetNumber}) को लिंक किया जा रहा है... कृपया ग्रुप चैट में आने वाले कोड का इंतज़ार करें।` });

                try {
                    let tempSock = makeWASocket({
                        auth: (await useMultiFileAuthState('temp_session_' + targetNumber)).state,
                        logger: pino({ level: 'silent' }),
                        browser: ["Ubuntu", "Chrome", "20.0.04"]
                    });

                    await delay(3000);
                    const pairingCode = await tempSock.requestPairingCode(targetNumber.trim());
                    
                    let successText = `🎉 *${BOT_NAME} लिंक कोड रेडी है!* 🎉\n\n` +
                                      `👤 *यूज़र:* @${targetNumber}\n` +
                                      `🔑 *कोड:* ` + '`' + pairingCode + '`' + `\n\n` +
                                      `👉 इस कोड को कॉपी करें। अपने WhatsApp -> Linked Devices -> Link with phone number में जाकर इसे पेस्ट कर दें!`;
                    
                    await sock.sendMessage(from, { text: successText, mentions: [targetNumber + '@s.whatsapp.net'] });

                } catch (err) {
                    console.log(err);
                    await sock.sendMessage(from, { text: `❌ दुखद, कोड जेनरेट करने में समस्या हुई। कृपया नंबर दोबारा जांचें।` });
                }
            }

            if (!isGroup) return; 

            // 📜 २. कस्टमाइज्ड मेनू कमांड (!menu)
            if (command === 'menu' || command === 'help') {
                let menuText = `⚡ *🔥 ${BOT_NAME} MAIN MENU 🔥* ⚡\n\n` +
                               `👑 *Owner:* ${OWNER_NAME}\n` +
                               `👤 *User:* ${pushName}\n` +
                               `────────────────────\n\n` +
                               `🔑 *BOT LINK COMMAND:* \n` +
                               `» ` + '`!join [नंबर]`' + ` - ग्रुप से बिना QR कोड के बोट लिंक करें।\n\n` +
                               `🎵 *MUSIC COMMANDS:* \n` +
                               `» ` + '`!play [गाने का नाम]`' + ` - यूट्यूब से ऑडियो गाना प्ले करें।\n\n` +
                               `🛡️ *GROUP MANAGEMENT:* \n` +
                               `» ` + '`!tagall`' + ` - ग्रुप के सभी सदस्यों को टैग करें।\n` +
                               `» ` + '`!ping`' + ` - बोट की रनिंग स्पीड देखें।\n\n` +
                               `────────────────────\n` +
                               `📢 *Official Channel:* ${CHANNEL_LINK}`;

                await sock.sendMessage(from, { 
                    image: { url: MENU_IMAGE_URL }, 
                    caption: menuText 
                });
            }

            // ⚡ PING कमांड
            if (command === 'ping') {
                const start = new Date().getTime();
                const pmsg = await sock.sendMessage(from, { text: 'स्पीड जांची जा रही है...' });
                const end = new Date().getTime();
                await sock.sendMessage(from, { delete: pmsg.key }); 
                await sock.sendMessage(from, { text: `🚀 *${BOT_NAME} Speed:* ${end - start}ms\n🟢 स्टेटस: ऑनलाइन!` });
            }

            // 📢 TAG ALL कमांड
            if (command === 'tagall') {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants;
                let mentions = [];
                let text = `📢 *${BOT_NAME} - TAG ALL* 📢\n💬 *संदेश:* ${args.join(' ') || 'कोई संदेश नहीं'}\n\n`;
                
                for (let participant of participants) {
                    text += `👥 @${participant.id.split('@')[0]}\n`;
                    mentions.push(participant.id);
                }
                await sock.sendMessage(from, { text: text, mentions: mentions });
            }

            // 🎵 ३. वर्किंग सॉन्ग प्ले कमांड (!play)
            if (command === 'play') {
                const songName = args.join(' ');
                if (!songName) return sock.sendMessage(from, { text: '❌ कृपया गाने का नाम लिखें।' });
                
                await sock.sendMessage(from, { text: `🎵 *${BOT_NAME}* यूज़र *${pushName}* के लिए गाना खोज रहा है...` });
                
                try {
                    const searchResult = await ytSearch(songName);
                    const video = searchResult.videos[0];
                    if (!video) return sock.sendMessage(from, { text: '❌ गाना नहीं मिल पाया।' });
                    
                    await sock.sendMessage(from, { text: `🎧 *डाउनलोड शुरू:* "${video.title}"...` });
                    const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
                    
                    await sock.sendMessage(from, { 
                        audio: { stream: stream }, 
                        mimetype: 'audio/mp4', 
                        fileName: `${video.title}.mp4` 
                    });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ डाउनलोड फेल हो गया।' });
                }
            }

            // ओनर-ओनली कमांड्स
            if (command === 'makeadmin') {
                if (!isOwner) return sock.sendMessage(from, { text: `❌ सिर्फ ओनर *${OWNER_NAME}* ही यह कर सकते हैं!` });
                let users = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || mek.message.extendedTextMessage?.contextInfo?.participant;
                if (!users) return sock.sendMessage(from, { text: 'कृपया यूज़र को टैग करें।' });
                await sock.groupParticipantsUpdate(from, [users], "promote");
            }

            if (command === 'removeadmin') {
                if (!isOwner) return sock.sendMessage(from, { text: `❌ सिर्फ ओनर *${OWNER_NAME}* ही यह कर सकते हैं!` });
                let users = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || mek.message.extendedTextMessage?.contextInfo?.participant;
                if (!users) return sock.sendMessage(from, { text: 'कृपया यूज़र को टैग करें।' });
                await sock.groupParticipantsUpdate(from, [users], "demote");
            }

        } catch (err) {
            console.log(err);
        }
    });
}

startBot();

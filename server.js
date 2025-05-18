const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const admin = require('firebase-admin');
const crypto = require('crypto');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DB_URL
});
const db = admin.database();


app.get('/', async (req, res) => {
    const snapshot = await db.ref('/').once('value');
    const studentData = snapshot.val();

    const years = Object.entries(studentData.years).map(([year, yearData]) => ({
        year,
        image: yearData.image
    }));

    res.render('index', { 
        title: 'Ana Sayfa | Yıllık 75',
        years
    });
});

app.get('/hakkinda', (req, res) => {
    res.render('hakkinda', { 
        title: 'Hakkında | Yıllık 75'
    });
});

app.get('/mezunlar', (req, res) => {
    res.redirect('/')
});

app.get('/mezunlar/:year', async (req, res) => {
    const year = req.params.year;
    const snapshot = await db.ref('/').once('value');
    const studentData = snapshot.val();
    const yearData = studentData.years[year];

    if (!yearData) {
        return res.status(404).render('404', { title: 'Sayfa Bulunamadı | Yıllık 75' });
    }

    const classes = Object.entries(yearData.classes).map(([className, classData]) => ({
        name: className,
        students: classData.students ? classData.students.length : 0,
        image: classData.image
    }));

    res.render('year', { 
        title: `${year} Mezunları | Yıllık 75`, 
        year,
        yearImage: yearData.image,
        classes
    });
});

app.get('/mezunlar/:year/:className', async (req, res) => {
    const { year, className } = req.params;
    const snapshot = await db.ref('/').once('value');
    const studentData = snapshot.val();
    const classData = studentData.years[year]?.classes?.[className];

    if (!classData) {
        return res.status(404).render('404', { title: 'Sayfa Bulunamadı | Yıllık 75' });
    }

    res.render('classes', { 
        title: `${year} - ${className} Mezunları | Yıllık 75`, 
        year, 
        className,
        classImage: classData.image,
        students: classData.students
    });
});

app.get('/mezunlar/:year/:className/:studentNumber', async (req, res) => {
    const { year, className, studentNumber } = req.params;
    const snapshot = await db.ref('/').once('value');
    const studentData = snapshot.val();
    const students = studentData.years[year]?.classes?.[className]?.students;
    const student = students?.find(s => s.number === studentNumber);

    if (!student) {
        return res.status(404).render('404', { title: 'Sayfa Bulunamadı | Yıllık 75' });
    }

    res.render('student', { 
        title: `${year} - ${className} - ${student.name}`,
        year,
        className,
        student
    });
});

app.get('/search', async (req, res) => {
    const query = req.query.q?.toLowerCase().trim();
    const snapshot = await db.ref('/').once('value');
    const studentData = snapshot.val();

    if (!query) {
        return res.render('search', { title: 'Mezun Ara | Yıllık 75', results: [], query: '' });
    }

    let results = [];
    for (const [year, yearData] of Object.entries(studentData.years)) {
        for (const [className, classData] of Object.entries(yearData.classes)) {
            for (const student of classData.students) {
                if (
                    student.name.toLowerCase().includes(query) ||
                    student.number === query ||
                    ( Array.isArray(student.socials) && student.socials.some( s => s.name.toLowerCase() === 'instagram' && ( (s.link && s.link.toLowerCase().includes(query)) || (s.username && s.username.toLowerCase().includes(query)) ) ) ) ) {
                    
                    results.push({
                        year,
                        className,
                        student
                    });
                }
            }
        }
    }

    res.render('search', { title: 'Mezun Ara | Yıllık 75', results, query });
});

app.get('/bildir', requireAdmin, (req, res) => {
    res.render('bildir');
});

app.post('/bildir', requireAdmin, (req, res) => {
    console.log('Bildirim:', req.body);
    return res.redirect('/');
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
function parseCookies(req) {
    const list = {};
    const rc = req.headers.cookie;
    if (rc) {
        rc.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }
    return list;
}

function requireAdmin(req, res, next) {
    const cookies = parseCookies(req);
    if (cookies.admin === 'true') {
        return next();
    }
    res.redirect('/admin/login');
}

app.get('/admin', requireAdmin, (req, res) => {
    res.render('admin', { title: 'Admin Paneli' });
});

app.get('/admin/login', (req, res) => {
    res.render('admin_login', { error: null });
});

app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const sessionToken = crypto.randomBytes(32).toString('hex');

        res.setHeader('Set-Cookie', [
            `admin=true; Path=/; HttpOnly; SameSite=Strict; Secure${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
        ]);
        return res.redirect('/admin');
    }
    res.render('admin_login', { error: 'Hatalı şifre' });
});

app.get('/data.json', cors(), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'data.json'));
});

app.get('/admin/json', requireAdmin, (req, res) => {
    res.render('admin_json', { title: 'JSON | Admin Paneli' });
});

app.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        const apiKey = process.env.IMGBB_API;

        if (!apiKey) {
            console.error('IMGBB API key is missing.');
            return res.status(500).json({ error: 'IMGBB API key missing' });
        }

        if (!req.file) {
            console.error('No file received in the request.');
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        const imageBase64 = req.file.buffer.toString('base64');
        console.info(`Uploading image of size: ${req.file.size} bytes`);

        const form = new FormData();
        form.append('key', apiKey);
        form.append('image', imageBase64);

        const response = await axios.post('https://api.imgbb.com/1/upload', form, {
            headers: form.getHeaders(),
            timeout: 20000 // 20 seconds
        });

        if (response.data?.data?.url) {
            console.info('Upload successful:', response.data.data.url);
            return res.json({ url: response.data.data.url });
        } else {
            console.error('Upload failed: unexpected response', response.data);
            return res.status(500).json({ error: 'Upload failed' });
        }
    } catch (err) {
        console.error('Upload error:', err.message);
        return res.status(500).json({ error: 'Upload error', details: err.message });
    }
});

app.post('/admin/add-student', requireAdmin, async (req, res) => {
  const { year, className, student } = req.body;
  const ref = db.ref(`years/${year}/classes/${className}/students`);
  const snapshot = await ref.once('value');
  const students = snapshot.val() || [];
  students.push(student);
  await ref.set(students);
  res.json({ success: true });
});

app.post('/admin/edit-student', requireAdmin, async (req, res) => {
  const { year, className, index, student } = req.body;
  const ref = db.ref(`years/${year}/classes/${className}/students`);
  const snapshot = await ref.once('value');
  const students = snapshot.val() || [];
  students[index] = student;
  await ref.set(students);
  res.json({ success: true });
});

app.post('/admin/remove-student', requireAdmin, async (req, res) => {
  const { year, className, index } = req.body;
  const ref = db.ref(`years/${year}/classes/${className}/students`);
  const snapshot = await ref.once('value');
  const students = snapshot.val() || [];
  students.splice(index, 1);
  await ref.set(students);
  res.json({ success: true });
});

app.get('/admin/firebase-data', requireAdmin, async (req, res) => {
  const snapshot = await db.ref('/').once('value');
  res.json(snapshot.val());
});

app.post('/admin/save-json', requireAdmin, async (req, res) => {
  const data = req.body;
  await db.ref('/').set(data);
  res.json({ success: true });
});

app.use((req, res) => {
    res.status(404).render('404', { title: 'Sayfa Bulunamadı' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

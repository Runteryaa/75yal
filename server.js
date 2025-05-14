const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config();

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


const studentData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data.json'), 'utf8'));

app.get('/', (req, res) => {
    const years = Object.entries(studentData.years).map(([year, yearData]) => ({
        year,
        image: yearData.image
    }));

    res.render('index', { 
        title: 'Ana Sayfa',
        years
    });
});

app.get('/hakkinda', (req, res) => {
    res.render('hakkinda', { 
        title: 'Hakkında'
    });
});

app.get('/mezunlar', (req, res) => {
    res.redirect('/')
});

app.get('/mezunlar/:year', (req, res) => {
    const year = req.params.year;
    const yearData = studentData.years[year];

    if (!yearData) {
        return res.status(404).send('Yıl bulunamadı');
    }

    const classes = Object.entries(yearData.classes).map(([className, classData]) => ({
        name: className,
        students: classData.students.length,
        image: classData.image
    }));

    res.render('year', { 
        title: `${year} Mezunları`, 
        year,
        yearImage: yearData.image,
        classes
    });
});

app.get('/mezunlar/:year/:className', (req, res) => {
    const { year, className } = req.params;
    const classData = studentData.years[year]?.classes?.[className];

    if (!classData) {
        return res.status(404).send('Sınıf bulunamadı');
    }

    res.render('classes', { 
        title: `${year} - ${className} Mezunları`, 
        year, 
        className,
        classImage: classData.image,
        students: classData.students
    });
});

app.get('/mezunlar/:year/:className/:studentNumber', (req, res) => {
    const { year, className, studentNumber } = req.params;
    const students = studentData.years[year]?.classes?.[className]?.students;
    const student = students?.find(s => s.number === studentNumber);

    if (!student) {
        return res.status(404).send('Öğrenci bulunamadı');
    }

    res.render('student', { 
        title: `${year} - ${className} - ${student.name}`,
        year,
        className,
        student
    });
});

app.get('/search', (req, res) => {
    const query = req.query.q?.toLowerCase().trim();
    if (!query) {
        return res.render('search', { title: 'Mezun Ara', results: [], query: '' });
    }

    let results = [];
    for (const [year, yearData] of Object.entries(studentData.years)) {
        for (const [className, classData] of Object.entries(yearData.classes)) {
            for (const student of classData.students) {
                if (
                    student.name.toLowerCase().includes(query) ||
                    student.number === query ||
                    ( Array.isArray(student.socials) && student.socials.some( s => s.name.toLowerCase() === 'instagram' && ( (s.link && s.link.toLowerCase().includes(query)) || (s.username && s.username.toLowerCase().includes(query)) ) ) )                ) {
                    
                    results.push({
                        year,
                        className,
                        student
                    });
                }
            }
        }
    }

    res.render('search', { title: 'Mezun Ara', results, query });
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
        res.setHeader('Set-Cookie', 'admin=true; Path=/; HttpOnly');
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

app.use((req, res) => {
    res.status(404).render('404', { title: 'Sayfa Bulunamadı' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
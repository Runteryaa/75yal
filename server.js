require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Load student data
const studentData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'students.json'), 'utf8'));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Place this before the dynamic routes
app.get('/hakkinda', (req, res) => {
    res.render('hakkinda', { 
        title: 'Hakkında'
    });
});

// Dynamic routes below...
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

// Change from '/:year/:className/:studentNumber' to '/mezunlar/:year/:className/:studentNumber'
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
                    student.number === query
                ) {
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

const reviewPath = path.join(__dirname, 'data', 'review.json');
app.use(express.urlencoded({ extended: true }));

app.post('/yorum-ekle', (req, res) => {
    const { year, className, studentNumber, author, text } = req.body;
    if (!year || !className || !studentNumber || !author || !text) {
        return res.status(400).send('Eksik bilgi');
    }

    const newReview = {
        year,
        className,
        studentNumber,
        author,
        text,
        date: new Date().toLocaleDateString('tr-TR'),
        approved: false
    };

    let reviews = [];
    try {
        if (fs.existsSync(reviewPath)) {
            reviews = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
        }
    } catch (err) {
        reviews = [];
    }
    reviews.push(newReview);
    fs.writeFileSync(reviewPath, JSON.stringify(reviews, null, 2), 'utf8');

    res.redirect(`/mezunlar/${year}/${className}/${studentNumber}`);
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
    res.redirect('/admin');
}

app.get('/admin', (req, res) => {
    res.render('admin_login', { error: null });
});

app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.setHeader('Set-Cookie', 'admin=true; Path=/; HttpOnly');
        return res.redirect('/admin/reviews');
    }
    res.render('admin_login', { error: 'Hatalı şifre' });
});

app.get('/admin/reviews', requireAdmin, (req, res) => {
    let reviews = [];
    try {
        if (fs.existsSync(reviewPath)) {
            reviews = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
        }
    } catch (err) {
        reviews = [];
    }
    res.render('admin_reviews', { reviews });
});

app.post('/admin/reviews/approve', requireAdmin, (req, res) => {
    const { year, className, studentNumber, author, text } = req.body;
    console.log('Approve request:', { year, className, studentNumber, author, text });

    let reviews = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
    const index = reviews.findIndex(r =>
        r.year === year &&
        r.className === className &&
        r.studentNumber === studentNumber &&
        r.author === author &&
        r.text === text
    );
    console.log('Review found at index:', index);

    if (index !== -1) {
        const studentsPath = path.join(__dirname, 'data', 'students.json');
        const studentsData = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));
        const student = studentsData.years[year]?.classes?.[className]?.students?.find(s => s.number === studentNumber);
        console.log('Student found:', !!student, student);

        if (student) {
            if (!student.comments) student.comments = [];
            student.comments.push({
                author,
                text,
                date: new Date().toLocaleDateString('tr-TR')
            });
            fs.writeFileSync(studentsPath, JSON.stringify(studentsData, null, 2), 'utf8');
            console.log('Comment added and students.json updated.');
        } else {
            console.log('Student not found, comment not added.');
        }
        reviews.splice(index, 1);
        fs.writeFileSync(reviewPath, JSON.stringify(reviews, null, 2), 'utf8');
        console.log('Review removed from review.json.');
    } else {
        console.log('Review not found in review.json.');
    }
    res.redirect('/admin/reviews');
});

app.post('/admin/reviews/reject', requireAdmin, (req, res) => {
    const { year, className, studentNumber, author, text } = req.body;
    let reviews = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
    reviews = reviews.filter(r =>
        !(r.year === year &&
        r.className === className &&
        r.studentNumber === studentNumber &&
        r.author === author &&
        r.text === text)
    );
    fs.writeFileSync(reviewPath, JSON.stringify(reviews, null, 2), 'utf8');
    res.redirect('/admin/reviews');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
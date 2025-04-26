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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
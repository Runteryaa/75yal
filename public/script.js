document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.getItem('isVisited')) {
        var infoDiv = document.getElementById('first-visit');
        if (infoDiv) {
            infoDiv.style.display = 'unset';
        }
        localStorage.setItem('isVisited', 'true');
    }
});

closeFirstVisit = function() {
    var infoDiv = document.getElementById('first-visit');
    if (infoDiv) {
        infoDiv.style.display = 'none';
    }
}
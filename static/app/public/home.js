const counters = document.querySelectorAll(".stat-number[data-target]");

counters.forEach(counter=>{
    const target = parseFloat(counter.dataset.target);
    let value = 0;

    const step = target / 80;

    function update(){
        value += step;
        if(value < target){
            counter.innerText = value.toFixed(1);
            requestAnimationFrame(update);
        }else{
            counter.innerText = target;
        }
    }

    update();
});

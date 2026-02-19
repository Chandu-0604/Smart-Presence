export function onViewDestroyed(view, callback){

    const observer = new MutationObserver(()=>{

        if(!document.body.contains(view)){
            observer.disconnect();
            callback();
        }
    });

    observer.observe(document.body,{
        childList:true,
        subtree:true
    });
}

function markComplete(lessonNumber){
  let progress = JSON.parse(localStorage.getItem("progress")) || [];

  if(!progress.includes(lessonNumber)){
    progress.push(lessonNumber);
    localStorage.setItem("progress", JSON.stringify(progress));
    showToast("Урок отмечен как пройденный!");
  } else {
    showToast("Этот урок уже отмечен");
  }
}

function showToast(message){
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerText = message;

  document.body.appendChild(toast);

  setTimeout(()=>{
    toast.classList.add("show");
  },100);

  setTimeout(()=>{
    toast.remove();
  },3000);
}
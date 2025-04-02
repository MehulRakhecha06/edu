from tkinter import*
from PIL import Image,ImageTk
window=Tk()
window.title("Image disply")
window.geometry("600x600")
upload=Image.open("tkinter_day_2\mehul.jpg")
image=ImageTk.PhotoImage(upload)
Imagelable=Label(image=image,height=300,width=260)
Imagelable.pack()
lable=Label(text="learning how to add images")
lable.pack()
window.mainloop()


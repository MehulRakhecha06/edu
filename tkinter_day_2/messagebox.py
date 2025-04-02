from tkinter import *
from tkinter import messagebox
window=Tk()
window.geometry("600x600")
window.title("learning messagebox")
def mehul():
    messagebox.showwarning("Alert","ERROR404")

button= Button(text="click me", command=mehul)
button.pack()
window.mainloop()


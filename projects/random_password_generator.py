import tkinter as tk
import random
import string

def generate_password(length):
    # Define the character pool
    characters = string.ascii_letters + string.digits + string.punctuation
    # Generate a random password
    password = ''.join(random.choice(characters) for _ in range(length))
    return password

def on_generate():
    try:
        length = int(length_entry.get())
        if length < 1:
            result_label.config(text="Length must be at least 1.")
            return
        password = generate_password(length)
        result_label.config(text=password)
    except ValueError:
        result_label.config(text="Please enter a valid number.")

# Create the main window
root = tk.Tk()
root.title("Random Password Generator")

# Create the length input label and entry
length_label = tk.Label(root, text="Password Length:")
length_label.pack(pady=5)
length_entry = tk.Entry(root)
length_entry.pack(pady=5)

# Create the generate button
generate_button = tk.Button(root, text="Generate Password", command=on_generate)
generate_button.pack(pady=10)

# Create the result label
result_label = tk.Label(root, text="", wraplength=300)
result_label.pack(pady=10)

# Start the Tkinter event loop
root.mainloop()
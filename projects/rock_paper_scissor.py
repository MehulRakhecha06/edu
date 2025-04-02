import tkinter as tk
import random

class RockPaperScissors:
    def __init__(self, master):
        self.master = master
        master.title("Rock Paper Scissors")

        self.user_choice = tk.StringVar()
        self.computer_choice = tk.StringVar()
        self.result = tk.StringVar()

        self.label = tk.Label(master, text="Choose your option:")
        self.label.pack(pady=10)

        self.rock_button = tk.Button(master, text="Rock", command=lambda: self.play("rock"))
        self.rock_button.pack(pady=5)

        self.paper_button = tk.Button(master, text="Paper", command=lambda: self.play("paper"))
        self.paper_button.pack(pady=5)

        self.scissors_button = tk.Button(master, text="Scissors", command=lambda: self.play("scissors"))
        self.scissors_button.pack(pady=5)

        self.user_label = tk.Label(master, textvariable=self.user_choice)
        self.user_label.pack(pady=5)

        self.computer_label = tk.Label(master, textvariable=self.computer_choice)
        self.computer_label.pack(pady=5)

        self.result_label = tk.Label(master, textvariable=self.result)
        self.result_label.pack(pady=5)

        self.play_again_button = tk.Button(master, text="Play Again", command=self.reset)
        self.play_again_button.pack(pady=10)
        self.play_again_button.config(state=tk.DISABLED)

    def play(self, user_input):
        self.user_choice.set(f"You chose: {user_input}")
        computer_input = random.choice(["rock", "paper", "scissors"])
        self.computer_choice.set(f"Computer chose: {computer_input}")

        if user_input == computer_input:
            self.result.set("It's a tie!")
        elif (user_input == "rock" and computer_input == "scissors") or \
             (user_input == "paper" and computer_input == "rock") or \
             (user_input == "scissors" and computer_input == "paper"):
            self.result.set("You win!")
        else:
            self.result.set("You lose!")

        self.play_again_button.config(state=tk.NORMAL)

    def reset(self):
        self.user_choice.set("")
        self.computer_choice.set("")
        self.result.set("")
        self.play_again_button.config(state=tk.DISABLED)

if __name__ == "__main__":
    root = tk.Tk()
    
    game = RockPaperScissors(root)
    root.mainloop()


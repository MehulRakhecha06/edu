class TodoList:
    def __init__(self):
        self.tasks = []

    def add_task(self, task):
        self.tasks.append(task)
        print(f"Added task: '{task}'")

    def view_tasks(self):
        if not self.tasks:
            print("No tasks in your todo list.")
        else:
            print("Your todo list:")
            for index, task in enumerate(self.tasks, start=1):
                print(f"{index}. {task}")

    def delete_task(self, task_number):
        try:
            task_index = task_number - 1
            removed_task = self.tasks.pop(task_index)
            print(f"Deleted task: '{removed_task}'")
        except IndexError:
            print("Invalid task number. Please try again.")

def main():
    todo_list = TodoList()

    while True:
        print("\nTO-DO List Application")
        print("1. Add Task")
        print("2. View Tasks")
        print("3. Delete Task")
        print("4. Exit")

        choice = input("Enter your choice: ")

        if choice == '1':
            task = input("Enter the task: ")
            todo_list.add_task(task)
        elif choice == '2':
            todo_list.view_tasks()
        elif choice == '3':
            try:
                task_number = int(input("Enter the task number to delete: "))
                todo_list.delete_task(task_number)
            except ValueError:
                print("Please enter a valid task number.")
        elif choice == '4':
            print("Exiting the application.")
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()
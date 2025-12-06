import utils.file_handler as file_handler
import general.general as general
def main():
    print("Data processing initializing.")
    #file_path = input("Enter the file path: ")
    file_path = "data/conversa.txt"
    df = file_handler.read_file(file_path)
    df = file_handler.clean_data(df)
    print(general.get_authors(df))
    print("Data processing complete.")

if __name__ == "__main__":
    main()
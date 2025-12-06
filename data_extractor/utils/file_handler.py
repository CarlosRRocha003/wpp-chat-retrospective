import re
import pandas as pd

def check_date_time_pattern(s):
    pattern = r'^\d{2}/\d{2}/\d{4} \d{2}:\d{2} -'
    result = re.match(pattern, s)
    return bool(result)

def process_line(line, message_buffer, data, date, time, author):
    """Helper function to process a single line."""
    line = line.strip()
    
    # Check for date_time pattern
    if check_date_time_pattern(line):
        if message_buffer:
            data.append([date, time, author, ' '.join(message_buffer)])
        message_buffer.clear()
        
        # Split date_time and message
        splitline = line.split(' - ', 1)
        if len(splitline) < 2:
            return date, time, author
        
        date_time, message = splitline
        date, time = date_time.split(" ")
        
        # Extract author if available
        if ": " in message:
            author, message = message.split(": ", 1)
        else:
            author, message = None, message
        
        message_buffer.append(message)
    else:
        message_buffer.append(line)
    
    return date, time, author

def read_file(file_path):
    print("Reading file...")
    data = []
    message_buffer = []
    date, time, author = None, None, None

    with open(file_path, encoding="utf-8") as fp:
        for line in fp:
            date, time, author = process_line(line, message_buffer, data, date, time, author)

    if len(message_buffer) > 0:
        data.append([date, time, author, ' '.join(message_buffer)])

    df = pd.DataFrame(data, columns=["Date", "Time", "Author", "Message"])
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce', format='%d/%m/%Y')

    data = df.dropna()
    print(data.head(10))
    return df



def clean_data(df):
    print("Cleaning data...")
    df['Author'] = df['Author'].fillna("Adm")
    return df
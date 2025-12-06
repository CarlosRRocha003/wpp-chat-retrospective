

def filter_stickers(df):
    media_format = df['Message'].str.contains(r'\.webp', na=False)
    media_pattern = df['Message'].str.contains(r'\(arquivo anexado\)', na=False)
    return df[media_format & media_pattern]

def filter_audios(df):
    media_format = df['Message'].str.contains(r'\.opus', na=False)
    media_pattern = df['Message'].str.contains(r'\(arquivo anexado\)', na=False)
    return df[media_format & media_pattern]
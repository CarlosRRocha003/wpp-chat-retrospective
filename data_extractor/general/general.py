import utils.message_patterns as message_patterns

def get_authors(df):
    authors = df['Author'].unique()
    return authors

def get_most_talkatives_rank(df):
    most_talkatives = df.groupby('Author')['Message'].count().sort_values(ascending=False)
    return most_talkatives

#should return the authors who sent the most stickers in order
#stickers are recognized as .webp format and has a (arquivo anexado) at the end
def get_authors_stickers_rank(df):
    stickers_df = message_patterns.filter_stickers(df)
    stickers_authors =  stickers_df.groupby('Author')['Message'].count().sort_values(ascending=False)
    return stickers_authors

#should return the most sent stickers in order
#stickers are recognized as .webp format and has a (arquivo anexado) at the end
def get_stickers_rank(df):
    stickers_df = message_patterns.filter_stickers(df)
    stickers =  stickers_df.groupby('Message')['Message'].count().sort_values(ascending=False)
    return stickers

#should return the authors who sent the most emojis in order
def get_authors_emojis_rank(df):
    pass

#should return the most sent emojis in order
def get_emojis_rank(df):
    pass

#should return the authors who sent the most audios in order
#audios are recognized as .opus format
def get_authors_audios_rank(df):
    audios_df = message_patterns.filter_audios(df)
    audios_authors =  audios_df.groupby('Author')['Message'].count().sort_values(ascending=False)
    return audios_authors

#should return the authors who sent the most laughs in order
#it has to consider at least two k's or two Ha's in a row, case insentive.
def get_authors_laughs_rank(df):
    pass

#should return the authors who sent the most media in order
#media can be images or videos(.jpg, .mp4)
def get_authors_media_rank(df):
    pass
cd Downloads

while true; do

echo -n 'LINK: '
read link

# FOR YOUTUBE:
# youtube-dl -f bestvideo+bestaudio --all-subs $link

# FOR YOUTUBE MP4:
youtube-dl -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio' --merge-output-format mp4 --all-subs $link

done
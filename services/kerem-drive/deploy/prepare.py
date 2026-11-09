import pathlib
root=pathlib.Path('/home/kerempi/kerem-drive')
root.joinpath('data').mkdir(mode=0o700,exist_ok=True)
pathlib.Path('/mnt/hdd/kerem-drive/files').mkdir(parents=True,exist_ok=True)
env=root/'.env'
if not env.exists():
    env.write_text('PORT=3400\nDATA_DIR=/home/kerempi/kerem-drive/data\nFILES_DIR=/mnt/hdd/kerem-drive/files\n')
    env.chmod(0o600)
    print('Environment created; no login required')
else:
    print('Existing environment preserved')

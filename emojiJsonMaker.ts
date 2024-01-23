import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

interface EmojiMeta {
    codes: string;
    status: string;
    emojiVersion: string;
    char: string;
    name: string;
    category: string;
    group: string;
    subgroup: string;
}

interface EmojiCollection {
    comments: string;
    full: EmojiMeta[];
    compact: string[];
}

const EMOJI_VERSION: string = 'latest'; //'15.1';

export async function makeEmojiList() {
    try {
        const text: string = await getTestFile(EMOJI_VERSION);
        const collected: EmojiCollection = getCollection(text);

        console.log(`Format text to json...`);
        console.log(`Processed emojis: ${collected.full.length}`);
        console.log('Write file: emoji.json, emoji-compact.json \n');

        await writeFiles(collected);

        console.log(collected.comments);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

async function getTestFile(ver: string): Promise<string> {
    const url: string = `https://unicode.org/Public/emoji/${ver}/emoji-test.txt`;

    process.stdout.write(`Fetch emoji-test.txt (v${EMOJI_VERSION})`);
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let text: string = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                process.stdout.write('.');
                text += chunk;
            });
            res.on('end', () => {
                process.stdout.write('\n');
                resolve(text);
            });
            res.on('error', reject);
        });
    });
}

function getCollection(text: string): EmojiCollection {
    const collected: EmojiCollection = text.trim().split('\n').reduce((accu: EmojiCollection, line) => {
        let group: string = '';
        let subgroup: string = ';'
        if (line.startsWith('# group: ')) {
            console.log(`  Processing ${line.substr(2)}...`);
            group = line.substr(9);
        } else if (line.startsWith('# subgroup: ')) {
            subgroup = line.substr(12);
        } else if (line.startsWith('#')) {
            accu.comments = accu.comments + line + '\n';
        } else {
            const meta: EmojiMeta | null = parseLine(line);
            if (meta && (meta.status === 'fully-qualified' || meta.status === 'component')) {
                meta.category = `${group} (${subgroup})`;
                meta.group = group;
                meta.subgroup = subgroup;
                accu.full.push(meta);
                accu.compact.push(meta.char);
            } else {
                accu.comments = accu.comments.trim() + '\n\n';
            }
        }
        return accu;
    }, { comments: '', full: [], compact: [] });
    return collected;
}

function parseLine(line: string): any | null {
    const data: string[] = line.trim().split(/\s+[;#] /);

    if (data.length !== 3) {
        console.log(data);
        return null;
    }

    const [codes, status, charAndName]: string[] = data;
    const [, char, version, name]: any = charAndName.match(/^(\S+) (E\d+\.\d+) (.+)$/);
    const emojiVersion: string = version.slice(1);

    return { codes, status, emojiVersion, char, name };
}

function writeFiles({ full, compact }: EmojiCollection): void {
    const rel = (...args: string[]) => path.resolve(__dirname, ...args);

    fs.writeFileSync(rel('emoji.json'), JSON.stringify(full), 'utf8');
    fs.writeFileSync(rel('emoji-compact.json'), JSON.stringify(compact), 'utf8');
}

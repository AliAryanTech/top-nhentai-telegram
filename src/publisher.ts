import './helpers/env';
import bot from './helpers/bot';
import { Lang } from './helpers/nhentai';
import { Channel, ChannelModel, Gallery, GalleryModel } from './models';
import { ChannelPostModel } from './models/channelPost';
import { Ref } from '@typegoose/typegoose';
import { PUBLISHER_INTERVAL } from './constants/intervals';

const langEmoji: Record<Lang, string> = {
    [Lang.English]: '🇬🇧',
    [Lang.Japanese]: '🇯🇵',
    [Lang.Chinese]: '🇨🇳',
    [Lang.Unknown]: '🏳️',
};

const formatPost = (gallery: Gallery): string => {
    if (gallery.telegraphLinks.length === 1) {
        return `${langEmoji[gallery.lang]} <a href="${gallery.telegraphLinks[0]}">${gallery.title}</a>`;
    } else {
        return `${langEmoji[gallery.lang]} ${gallery.title}:\n${gallery.telegraphLinks
            .map((link, idx) => `${idx}: ${link}`)
            .join('\n')}`;
    }
};

export class Publisher {
    constructor() {}

    async process() {
        console.log('Time to post galleries');
        const channels = await ChannelModel.find({ posting: true });
        for (const channel of channels) {
            await this.processChannel(channel);
        }
    }

    start() {
        setTimeout(async () => {
            try {
                await this.process();
            } catch (e) {
                console.log(`Publisher failed: ${e.toString()}. Stack: ${e.stack}`);
            }
            this.start();
        }, PUBLISHER_INTERVAL);
    }

    async processChannel(channel: Channel) {
        const posts = await ChannelPostModel.find({ channel: channel });
        const galleries: Array<Ref<Gallery>> = posts.map((post) => post.gallery);
        //@ts-ignore
        const newGalleries = await GalleryModel.find({ _id: { $nin: galleries }, ready: true });
        for (const gallery of newGalleries) {
            const text = formatPost(gallery);
            const msg = await bot.telegram.sendMessage(channel.id, text, {
                parse_mode: 'HTML',
            });
            await ChannelPostModel.create({ channel, gallery, messageId: msg.message_id });
            console.log(`Posted ${gallery.title} to ${channel.title}`);
            break;
        }
    }
}

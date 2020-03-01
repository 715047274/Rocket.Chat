import { Rooms, Subscriptions } from '../../../models/server';
import { settings } from '../../../settings/lib/settings';
import { getDefaultSubscriptionPref } from '../../../utils';

const generate = (fname, name, user, extra) => ({
	open: false,
	alert: false,
	unread: 0,
	userMentions: 0,
	groupMentions: 0,
	...user.customFields && { customFields: user.customFields },
	...getDefaultSubscriptionPref(user),
	...extra,
	t: 'd',
	fname,
	name,
	u: {
		_id: user._id,
		username: user.username,
	},
});

const getFname = (uid, members) => members.filter(({ _id }) => _id !== uid).map(({ name, username }) => name || username).join(', ');
const getName = (uid, members) => members.filter(({ _id }) => _id !== uid).map(({ username }) => username).join(', ');

export const createDirectRoom = function(members, roomExtraData = {}, options = {}) {
	if (members.length > settings.get('DirectMesssage_maxUsers')) {
		return;
	}

	const rid = members.map(({ _id }) => _id).sort().join(''); // TODO provide a better rid heuristic

	const { insertedId } = Rooms.upsert({ _id: rid }, {
		$setOnInsert: {
			t: 'd',
			usernames: members.map(({ username }) => username),
			usersCount: members.length,
			msgs: 0,
			ts: new Date(),
			...roomExtraData,
		},
	});
	if (members.length === 1) { // dm to yourself
		Subscriptions.upsert({ rid, 'u._id': members[0]._id }, {
			$setOnInsert: generate(members[0].name || members[0].username, members[0].username, members[0], { ...options.subscriptionExtra, open: true }),
		});
	} else {
		members.forEach((member) => Subscriptions.upsert({ rid, 'u._id': member._id }, {
			$setOnInsert: generate(getFname(member._id, members), getName(member._id, members), member, { ...options.subscriptionExtra, ...options.creator === member._id && { open: true } }),
		}));
	}

	return {
		_id: rid,
		t: 'd',
		inserted: !!insertedId,
	};
};

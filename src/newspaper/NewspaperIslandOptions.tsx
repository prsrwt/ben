// The Newspaper's options on Ben Island (right of the search bar), for the Newspaper window in front: Contents,
// the paper's index (its sections, and the stories in each, with their printed pages), as for a book in the Reader.

import { useValues } from 'kea'

import { WindowId } from '~/desktop/windowsLogic'
import { ContentsButton } from '~/reader/ContentsMenu'

import { newspaperLogic } from './newspaperLogic'

export function NewspaperIslandOptions({ windowId }: { windowId: WindowId }): JSX.Element {
    const { open } = useValues(newspaperLogic)
    return <ContentsButton windowId={windowId} enabled={open?.status === 'ready'} />
}

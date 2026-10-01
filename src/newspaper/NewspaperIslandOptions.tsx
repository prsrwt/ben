// The Newspaper's options on Ben Island (right of the search bar), for the Newspaper window in front: Contents,
// the paper's index (its sections, and the stories in each, with their printed pages), as for a book in the Reader;
// and "Aa", reading comfort (text size, paper tone, the break reminder).

import { useValues } from 'kea'

import { WindowId } from '~/desktop/windowsLogic'
import { ContentsButton } from '~/reader/ContentsMenu'

import { ComfortButton } from './ComfortMenu'

import { newspaperLogic, paperWindow } from './newspaperLogic'

export function NewspaperIslandOptions({ windowId }: { windowId: WindowId }): JSX.Element {
    const { open } = paperWindow(useValues(newspaperLogic).windows, windowId)
    return (
        <div className="flex items-center gap-1.5" role="group" aria-label="Newspaper">
            <ContentsButton windowId={windowId} enabled={open?.status === 'ready'} />
            <ComfortButton />
        </div>
    )
}

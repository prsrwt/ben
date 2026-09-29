// What each window shows. The Reader is built; the rest are empty placeholders for now. To build one
// out, give it its own component and map its id to it here.

import { ReaderView } from '~/reader/ReaderView'

import { APPS, AppId } from './apps'
import { WindowState } from './windowsLogic'

function EmptyWindow({ id }: { id: AppId }): JSX.Element {
    return (
        <div className="h-full min-h-60 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <h2 className="text-lg font-semibold m-0">{APPS[id].title}</h2>
            <p className="text-tertiary text-sm m-0">Nothing here yet.</p>
        </div>
    )
}

export function WindowContent({ window }: { window: WindowState }): JSX.Element {
    return window.appId === 'reader' ? <ReaderView windowId={window.id} /> : <EmptyWindow id={window.appId} />
}

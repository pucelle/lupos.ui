import {css, Component, html, RenderResult, TemplateResult, ComponentStyle} from '@pucelle/lupos.js'
import {theme, ThemeSize} from '../style'
import {DOMEvents, EventKeys, Observed, fold, effect} from '@pucelle/ff'
import {ListDataNavigator} from './list-helpers/list-data-navigator'
import {Icon} from './icon'
import {tooltip} from '../bindings'


/** Base type of list item. */
export type ListItem<T = any> = {

	/** Unique value to identify current item. */
	value: any

	/** List item content, can be a pre-generated template result. */
	text?: string | TemplateResult

	/** 
	 * Plain text to do search and filter.
	 * If need to search, and `searchText` is omit,
	 * `text` must be string type.
	 */
	searchText?: string

	/** 
	 * List item icon type.
	 * Can be empty string to make it not show icon, but have a icon placeholder.
	 */
	icon?: string

	/** 
	 * Tooltip content to show as tooltip when mouse hover,
	 * can be a pre-generated template result.
	 */
	tip?: string | TemplateResult

	/** To render subsection list. */
	children?: ListItem<T>[]
}

export interface ListEvents<T> {

	/** 
	 * Fires after selected items changed.
	 * Only user interaction can cause `select` event get triggered.
	 */
	select: (selected: ReadonlyArray<T>) => void

	/** Fires after clicked a list item. */
	click: (clicked: T) => void
}


/** 
 * `<List>` will render data items as a list,
 * and supports sub list.
 * Otherwise it provides single or multiple selection,
 * and direction key navigation.
 * 
 * Use it like:
 * `<List .data=${[{text, icon?, tip?}]}>` or
 * `<List .data=${[...]} .itemRenderer=${(item) => html`...`}>`
 */
export class List<T = any, E = {}> extends Component<E & ListEvents<T>> {

	/** Walk item and all descendant items recursively. */
	static *walkItems<T>(item: ListItem<T>): Iterable<ListItem<T>> {
		yield item

		if (item.children) {
			for (let child of item.children) {
				yield* List.walkItems(child)
			}
		}
	}

	static style: ComponentStyle = () => {
		let {mainColor, borderColor} = theme

		return css`
		.list{
			display: block;
			border-bottom: 1px solid ${borderColor.alpha(0.4)};
		}
		
		.list-item{
			position: relative;
			display: flex;
			padding: 0.4em 0;
			cursor: pointer;
			border-top: 1px solid ${borderColor.alpha(0.4)};

			&:first-child{
				border-top: none;
			}

			&:hover{
				color: ${mainColor};
			}

			&.selected{
				color: ${mainColor};
			}

			&.navigated{
				color: ${mainColor};

				&::after{
					content: '';
					position: absolute;
					top: 3px;
					bottom: 3px;
					right: 0;
					width: 2px;
					background: ${mainColor.alpha(0.8)};
				}
			}

			&.arrow-selected{
				background-color: ${mainColor.alpha(0.1)};
			}
		}

		.list-toggle-placeholder{
			display: flex;
			width: 1.6em;
			opacity: 0.7;
		}

		.list-icon-placeholder{
			display: flex;
			width: 1.6em;
		}

		.list-icon{
			margin-right: 0.2em;
		}

		.list-content{
			flex: 1;
			min-width: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			padding-right: 4px;
		}

		.list-selected-icon{
			margin: 0 0.2em;
		}

		.list-subsection{
			padding-left: 1.6em;
			padding-bottom: 4px;
			overflow: hidden;
			font-size: 0.928em;

			.list-item{
				padding-top: 0.2em;
				padding-bottom: 0.2em;
				border-top: none;
				line-height: calc(1lh - 2px);
			}

			.list-subsection{
				font-size: 1em;
				padding-top: 0;
			}

			.list-subsection:not(:last-child){
				padding-bottom: 3px;
				margin-bottom: 3px;
				border-bottom: 1px solid ${borderColor.alpha(0.4)};
			}

			.list-subsection:last-child{
				padding-bottom: 0;
				margin-bottom: 0;
			}
		}
		`
	}


	size: ThemeSize = 'default'

	/** List mode:
	 * - `selection`: provide single item or multiple items selection with a check icon to indicate.
	 * - `navigation`: provide single item navigation with a vertical line icon on the right to indicate.
	 * Default value is `selection`.
	 */
	mode: 'selection' | 'navigation' = 'selection'

	/** 
	 * Whether each item is selectable, only available for `selection` mode.
	 * Default value is `false`.
	 */
	selectable: boolean = false

	/** 
	 * Whether can select multiple items, only available for `selection` mode.
	 * Default value is `false`.
	 */
	multipleSelect: boolean = false

	/** 
	 * Whether can select directory.
	 * If specifies as `false`, items have children will not be selected.
	 * Default value is `true`.
	 */
	dirSelectable: boolean = true

	/** Input data list. */
	data: ListItem<T>[] = []

	/** 
	 * Renderer to render each item display content.
	 * If specifies, it overwrites default action of rendering item content.
	 */
	itemRenderer: ((item: ListItem<T>) => RenderResult | string | number) | null = null

	/** Indicates current select values. */
	selected: T[] = []

	/** Currently expanded items. */
	expanded: T[] = []

	/** 
	 * If specified, when this element get focus,
	 * you can use keyboard arrow keys to navigate across current list.
	 */
	keyComeFrom: HTMLInputElement | HTMLTextAreaElement | null = null

	/** 
	 * Selected and all parental indices by keyboard navigation.
	 * Only the last index is the truly selected.
	 */
	protected readonly keyNavigator: ListDataNavigator<T> = new ListDataNavigator()

	/** Whether watching keyboard navigation events. */
	private inKeyNavigating: boolean = false

	@effect
	protected applyKeyNavigatorProperties() {
		this.keyNavigator.update(this.data, this.expanded)
	}

	protected render() {
		return html`
		<template class="list">
			${this.renderItems(this.data)}
		</template>
		`
	}

	protected renderItems(items: Observed<ListItem<T>[]>): RenderResult[] {
		let anySiblingHaveChildren = items.some(item => item.children)

		return items.map((item: ListItem<T>) => {
			return this.renderItem(item, anySiblingHaveChildren)
		})
	}

	protected renderItem(item: Observed<ListItem<T>>, anySiblingHaveChildren: boolean): RenderResult {
		let expanded = this.expanded.includes(item.value)

		return html`
			<div
				class="list-item"
				:class=${this.renderActiveSelectedClassName(item)}
				:class.arrow-selected=${item === this.keyNavigator.current}
				@click.prevent=${() => this.onClickItem(item)}
			>
				<lu:if ${item.children && item.children.length > 0}>
					<div class='list-toggle-placeholder'
						@click.stop=${() => this.toggleExpanded(item)}
					>
						<Icon .type=${expanded ? 'triangle-down' : 'triangle-right'} .size="inherit" />
					</div>
				</lu:if>

				<lu:elseif ${anySiblingHaveChildren}>
					<div class='list-toggle-placeholder' />
				</lu:elseif>

				<lu:if ${item.icon !== undefined}>
					<div class='list-icon'>
						<lu:if ${item.icon}>
							<Icon .type=${item.icon} .size="inherit" />
						</lu:if>
					</div>
				</lu:if>

				<div class="list-content">
					${this.renderItemContent(item)}
				</div>

				<lu:if ${this.mode === 'selection' && this.isSelected(item)}>
					<Icon class="list-selected-icon" .type="checked" .size="inherit" />
				</lu:if>
			</div>

			<lu:if ${item.children && expanded}>
				<div class="list-subsection" :transition.immediate=${fold()}>
					${this.renderItems(item.children!)}
				</div>
			</lu:if>
		`
	}

	protected renderActiveSelectedClassName(item: Observed<ListItem<T>>) {
		if (this.mode === 'navigation') {
			if (this.isSelected(item)) {
				return 'navigated'
			}
		}
		else {
			if (this.isSelected(item)) {
				return 'selected'
			}
		}
		
		return ''
	}

	/** 
	 * Render item content, can be overwritten for sub classes
	 * who know about more details about data items.
	 */
	protected renderItemContent(item: Observed<ListItem<T>>) {
		if (this.itemRenderer) {
			return html`
			<div class="list-content">
				${this.itemRenderer(item)}
			</div>
			`
		}
		else {
			return html`
				<div class="list-content"
					?:tooltip=${item.tip, item.tip}
				>
					${item.text}
				</div>
			`
		}
	}

	/** Whether an item has been selected.  */
	protected isSelected(item: Observed<ListItem<T>>): boolean {
		return this.selected.includes(item.value)
	}

	/** Toggle expanded state. */
	protected toggleExpanded(item: Observed<ListItem<T>>) {
		if (this.expanded.includes(item.value)) {
			this.expanded.splice(this.expanded.indexOf(item.value), 1)
		}
		else {
			this.expanded.push(item.value)
		}
	}

	/** Do selection or navigation. */
	protected onClickItem(this: List, item: Observed<ListItem<T>>) {
		if (this.selectable && (this.dirSelectable || !item.children)) {
			if (this.multipleSelect) {
				if (this.selected.includes(item.value)) {
					this.selected.splice(this.selected.indexOf(item), 1)
				}
				else {
					this.selected.push(item.value)
				}
			}
			else {
				this.selected = [item.value]
			}

			this.fire('select', this.selected)
		}

		this.fire('click', item)
	}

	/** Expand item, and all of it's ancestors recursively. */
	expandDeeply(value: T) {
		this.applyExpandedRecursively(this.data, value)
	}

	/** 
	 * Make active item been expanded recursively.
	 * Returns whether any of items has expanded descendants.
	  */
	private applyExpandedRecursively(items: ListItem<T>[], active: T): boolean {
		return items.some(item => {
			if (item === active) {
				return true
			}

			if (item.children) {
				let hasActiveChildItem = this.applyExpandedRecursively(item.children, active)
				if (hasActiveChildItem) {
					if (!this.expanded.includes(item.value)) {
						this.expanded.push(item.value)
					}
				}
			}

			return false
		})
	}


	private lastKeyComeFrom: HTMLElement | null = null

	/** On `keyComeFrom` property change. */
	@effect
	protected onKeyComeFromChange() {
		if (!this.keyComeFrom) {
			return
		}

		if (this.lastKeyComeFrom) {
			DOMEvents.off(this.lastKeyComeFrom, 'keydown', this.keyNavigateByEvent as any, this)
			DOMEvents.off(this.lastKeyComeFrom, 'blur', this.onKeyComeFromBlur, this)
		}

		if (this.keyComeFrom) {
			DOMEvents.on(this.keyComeFrom, 'keydown', this.keyNavigateByEvent as any, this)
			DOMEvents.on(this.keyComeFrom, 'blur', this.onKeyComeFromBlur, this)
		}

		this.lastKeyComeFrom = this.keyComeFrom
	}

	/** Moves arrow selected by a keyboard event. */
	protected keyNavigateByEvent(event: KeyboardEvent) {
		let key = EventKeys.getShortcutKey(event)

		// Active key navigation if not yet.
		if (key === 'ArrowUp' || key === 'ArrowDown') {
			this.inKeyNavigating = true
		}
		
		if (key === 'ArrowUp') {
			this.keyNavigator.moveUp()
		}
		else if (key === 'ArrowDown') {
			this.keyNavigator.moveDown()
		}
		else if (key === 'ArrowLeft') {
			if (this.inKeyNavigating) {
				this.keyNavigator.moveLeft()
			}
		}
		else if (key === 'ArrowRight') {
			if (this.inKeyNavigating) {
				let item = this.keyNavigator.current
				if (item && !this.expanded.includes(item.value) && item.children) {
					this.toggleExpanded(item)
					this.keyNavigator.moveRight()
				}
			}
		}
		else if (key === 'Enter') {
			if (this.inKeyNavigating) {
				let item = this.keyNavigator.current
				if (item) {
					this.onClickItem(item)
				}
			}
		}
		else if (key === 'Escape') {
			this.inKeyNavigating = false
			this.keyNavigator.clear()
		}
	}

	protected onKeyComeFromBlur() {
		this.inKeyNavigating = false
		this.keyNavigator.clear()
	}
}
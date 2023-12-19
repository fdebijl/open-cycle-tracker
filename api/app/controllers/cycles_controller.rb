class CyclesController < ApplicationController
  def index
    @cycles = Cycle.all

    render json: @cycles
  end

  def show
    @cycle = Cycle.find(params[:id])

    render json: @cycle
  end

  def filter
    @cycle = Cycle.last if params[:filter].key?(:current) && params[:filter][:current]

    render json: @cycle
  end

  # TODO: Crud operations
end
